var dimensions = {
    svgWidth: 600,
    svgHeight: 600,
    margin: {
        top: 50,
        right: 50,
        bottom: 50,
        left: 100
    }
};

const maxCount = 24000;

const colorScale = d3.scaleLinear()
    .domain([0, maxCount])
    .range(["#E0F8FF", "#000080"]);

const attributes = [
    "NUMBER OF PERSONS INJURED",
    "NUMBER OF PERSONS KILLED",
    "NUMBER OF PEDESTRIANS INJURED",
    "NUMBER OF PEDESTRIANS KILLED",
    "NUMBER OF CYCLIST INJURED",
    "NUMBER OF CYCLIST KILLED",
    "NUMBER OF MOTORIST INJURED",
    "NUMBER OF MOTORIST KILLED"
];

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);


let globdata;
let globgeodata;

d3.csv("cleaned_crash_data_zipc.csv").then(data => {
    globdata = data
    d3.json("Borough_Boundaries.geojson").then(geoData => {
        globgeodata = geoData
        updateVisualization(globdata)
    });
});

function updateVisualization(data) {
    drawBoroughsChart(bouroughCount(data), globgeodata, dimensions, colorScale);
    drawFactorsChart(factorsCount(data), dimensions, colorScale);
    drawVehiclesChart(vehiclesCount(data), dimensions, colorScale);
}

function filterDataByBorough(borough) {
    globdata = globdata.filter(row => row["BOROUGH"] === borough);
    updateVisualization(globdata);
}

function filterDataByAttribute(attribute) {
    globdata = globdata.filter(row => 
        row["CONTRIBUTING FACTOR VEHICLE 1"] === attribute || row["CONTRIBUTING FACTOR VEHICLE 2"] === attribute
    );
    updateVisualization(globdata);
}

function filterDataByTime(time) {
    globdata = globdata.filter(row => {
        const crashTime = parseInt(row["CRASH TIME"].split(":")[0]);
        return crashTime === time;
    });
    updateVisualization(globdata);
}

function filterDataByVehicle(vehicle) {
    globdata = globdata.filter(row => 
        row["VEHICLE TYPE CODE 1"] === vehicle || row["VEHICLE TYPE CODE 2"] === vehicle
    );
    updateVisualization(globdata);
}


function bouroughCount(data) {
    let boroughCounts = {};

    data.forEach(row => {
        let borough = row["BOROUGH"];
        if (boroughCounts[borough]) {
            boroughCounts[borough]++;
        } else {
            boroughCounts[borough] = 1;
        }
    });

    return boroughCounts;
}

function factorsCount(data) {
    let factorCounts = {};

    data.forEach(row => {
        let factor = row["CONTRIBUTING FACTOR VEHICLE 1"];
        let factor2 = row["CONTRIBUTING FACTOR VEHICLE 2"];
        if (factor != "none") {
            if (factorCounts[factor]) {
                factorCounts[factor]++;
            } else {
                factorCounts[factor] = 1;
            }
        }
        if (factor2 != "none") {
            if (factorCounts[factor2]) {
                factorCounts[factor2]++;
            } else {
                factorCounts[factor2] = 1;
            }
        }
    });

    return factorCounts;
}

function vehiclesCount(data) {
    let vehicleCounts = {};

    data.forEach(row => {
        let factor = row["VEHICLE TYPE CODE 1"];
        let factor2 = row["VEHICLE TYPE CODE 2"];

        if (factor.length > 1) {
            if (vehicleCounts[factor]) {
                vehicleCounts[factor]++;
            } else {
                vehicleCounts[factor] = 1;
            }
        }
        if (factor2.length > 1) {
            if (vehicleCounts[factor2]) {
                vehicleCounts[factor2]++;
            } else {
                vehicleCounts[factor2] = 1;
            }
        }
    });

    let filteredVehicles = Object.entries(vehicleCounts)
        .map(([type, count]) => ({
            type,
            count
        }));

    filteredVehicles.sort((a, b) => b.count - a.count);

    return filteredVehicles;
}

function drawBoroughsChart(boroughCounts, geoData, dimensions, colorScale) {
    d3.select('#boroughs').selectAll("*").remove();

    const svg = d3.select("#boroughs")
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight);

    const projection = d3.geoMercator().fitSize([dimensions.svgWidth, dimensions.svgHeight], geoData);
    const path = d3.geoPath().projection(projection);

    const paths = svg.selectAll("path")
        .data(globgeodata.features);

    paths.enter().append("path")
        .merge(paths)
        .attr("d", path)
        .attr("fill", d => {
            const count = boroughCounts[d.properties.boro_name];
            return colorScale(count);
        })
        .attr("class", "hover-border")
        .attr("stroke", "#000")
        .on('mouseover', (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html("<b>" + d.properties.boro_name + ":</b><br/>" + (boroughCounts[d.properties.boro_name] || 0) + " crashes")
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on('mouseout', () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on('click', (event, d) => {
            filterDataByBorough(d.properties.boro_name);
        });

    paths.exit().remove();
}

function drawFactorsChart(factorCounts, dimensions, colorScale) {

    d3.select("#bubbles").selectAll("*").remove();

    const svg = d3.select('#bubbles')
        .attr('width', dimensions.svgWidth)
        .attr('height', dimensions.svgHeight);

    let factors = Object.keys(factorCounts).map(key => ({
        factor: key,
        count: factorCounts[key]
    }));

    let maxCount = d3.max(factors, d => d.count);

    let radiusScale = d3.scaleSqrt()
        .domain([0, maxCount])
        .range([10, 100]);

    const labelThreshold = maxCount * 0.05;

    let simulation = d3.forceSimulation(factors)
        .force("charge", d3.forceManyBody().strength(15))
        .force("center", d3.forceCenter(dimensions.svgWidth / 2, dimensions.svgHeight / 2))
        .force("collision", d3.forceCollide().radius(d => radiusScale(d.count) + 1))
        .on("tick", ticked);

    function ticked() {

        let bubbles = svg.selectAll("circle")
            .data(factors, d => d.factor)
            .attr("class", "hover-border")
            .on('mouseover', (event, d) => {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html("<b>" + d.factor + ":</b><br/>" + d.count + " crashes")
                    .style("left", (event.pageX) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on('click', (event, d) => {
                filterDataByAttribute(d.factor)
            });

        bubbles.enter().append("circle")
            .attr("r", d => radiusScale(d.count))
            .attr("fill", d => colorScale(d.count))
            .merge(bubbles)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        bubbles.exit().remove();

        let labels = svg.selectAll("text")
            .data(factors.filter(d => d.count >= labelThreshold), d => d.factor);

        labels.enter().append("text")
            .text(d => d.factor)
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "10px")
            .attr("fill", "black")
            .merge(labels)
            .attr("x", d => d.x)
            .attr("y", d => d.y);

        labels.exit().remove();
    }
};

function drawVehiclesChart(filteredVehicles, dimensions, colorScale) {
    d3.select('#barchart').selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 150 };
    const width = dimensions.svgWidth - margin.left - margin.right;
    const height = dimensions.svgHeight - margin.top - margin.bottom;

    const svg = d3.select('#barchart')
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let yScale = d3.scaleBand()
        .domain(filteredVehicles.map(d => d.type))
        .rangeRound([0, height])
        .padding(0.1);

    let xScale = d3.scaleLinear()
        .domain([0, d3.max(filteredVehicles, d => d.count)])
        .range([0, width]);

    svg.selectAll(".bar")
        .data(filteredVehicles)
        .enter().append("rect")
        .attr("class", "bar hover-border")
        .attr("y", d => yScale(d.type))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => xScale(d.count))
        .attr("fill", d => colorScale(d.count))
        .on('mouseover', (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html("<b>" + d.type + ":</b><br/>" + d.count + " crashes")
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on('mouseout', () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on('click', (event, d) => {
            filterDataByVehicle(d.type)
        });

    svg.append("g")
        .call(d3.axisLeft(yScale));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
};


function drawIndividChart(indivdata, dimensions) {

    d3.select('#boroughs').selectAll("*").remove();

    var padding = { top: 20, right: 40, bottom: 30, left: 50 };

    var svg = d3.select('#boroughs') 
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight)

    var xScale = d3.scaleLinear()
        .domain(d3.extent(indivdata, function (d) { return d.LONGITUDE; }))
        .range([padding.left, dimensions.svgWidth - padding.right]);

    var yScale = d3.scaleLinear()
        .domain(d3.extent(indivdata, function (d) { return d.LATITUDE; }))
        .range([dimensions.svgHeight - padding.bottom, padding.top]);

    svg.append('g')
        .attr('transform', 'translate(0,' + (dimensions.svgHeight - padding.bottom) + ')')
        .call(d3.axisBottom(xScale));

    svg.append('g')
        .attr('transform', 'translate(' + padding.left + ',0)')
        .call(d3.axisLeft(yScale));

    svg.append('g')
        .selectAll('dot')
        .data(indivdata)
        .enter()
        .append('circle')
        .attr('cx', function (d) { return xScale(d.LONGITUDE); })
        .attr('cy', function (d) { return yScale(d.LATITUDE); })
        .attr('r', 3) 
        .style('fill', '#69b3a2');
};

var isCombinedVisualization = true;

function toggleVisualization() {
    isCombinedVisualization = !isCombinedVisualization;

    const button = document.getElementById("toggleButton");
    const buttonText = document.querySelector(".button-text");
    
    if (isCombinedVisualization) {
        button.classList.add("active");
        buttonText.textContent = "Show Individual Visualization";
        drawBoroughsChart(bouroughCount(globdata), globgeodata, dimensions, colorScale);
    } else {
        button.classList.remove("active");
        buttonText.textContent = "Show Boroughs Visualization";
        drawIndividChart(globdata, dimensions); 
    }
}

document.getElementById("toggleButton").addEventListener("click", toggleVisualization);
