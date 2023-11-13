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
    const boroughCounts = bouroughCount(globdata);
    const timeCounts = timesCount(globdata);
    const bubbleCounts = factorsCount(globdata);
    const vehicleCounts = vehiclesCount(globdata);

    drawTimesChart(timeCounts, dimensions);
    drawFactorsChart(bubbleCounts, dimensions, colorScale);
    drawVehiclesChart(vehicleCounts, dimensions, colorScale);

    d3.json("Borough_Boundaries.geojson").then(geoData => {
        globgeodata = geoData
        drawBoroughsChart(boroughCounts, geoData, dimensions, colorScale);
    });

});

function filterDataByBorough(borough) {
    const filteredData = globdata.filter(row => row["BOROUGH"] === borough);

    drawBoroughsChart(bouroughCount(filteredData), globgeodata, dimensions, colorScale);
    drawTimesChart(timesCount(filteredData), dimensions);
    drawFactorsChart(factorsCount(filteredData), dimensions, colorScale);
    drawVehiclesChart(vehiclesCount(filteredData), dimensions, colorScale);
}

function filterDataByAttribute(attribute) {
    const filteredData = globdata.filter(row => 
        row["CONTRIBUTING FACTOR VEHICLE 1"] === attribute || row["CONTRIBUTING FACTOR VEHICLE 2"] === attribute
    );
    
    drawBoroughsChart(bouroughCount(filteredData), globgeodata, dimensions, colorScale);
    drawTimesChart(timesCount(filteredData), dimensions);
    drawFactorsChart(factorsCount(filteredData), dimensions, colorScale);
    drawVehiclesChart(vehiclesCount(filteredData), dimensions, colorScale);
}

function filterDataByTime(time) {
    const filteredData = globdata.filter(row => {
        const crashTime = parseInt(row["CRASH TIME"].split(":")[0]);
        return crashTime === time;
    });

    drawBoroughsChart(bouroughCount(filteredData), globgeodata, dimensions, colorScale);
    drawTimesChart(timesCount(filteredData), dimensions);
    drawFactorsChart(factorsCount(filteredData), dimensions, colorScale);
    drawVehiclesChart(vehiclesCount(filteredData), dimensions, colorScale);
}


function filterDataByVehicle(vehicle) {
    const filteredData = globdata.filter(row => 
        row["VEHICLE TYPE CODE 1"] === vehicle || row["VEHICLE TYPE CODE 2"] === vehicle
    );

    drawBoroughsChart(bouroughCount(filteredData), globgeodata, dimensions, colorScale);
    drawTimesChart(timesCount(filteredData), dimensions);
    drawFactorsChart(factorsCount(filteredData), dimensions, colorScale);
    drawVehiclesChart(vehiclesCount(filteredData), dimensions, colorScale);
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

function timesCount(data) {
    let timeAttributesCounts = {};

    attributes.forEach(attr => {
        timeAttributesCounts[attr] = {};
        for (let i = 0; i < 24; i++) {
            timeAttributesCounts[attr][i] = 0;
        }
    });

    data.forEach(row => {
        let time = parseInt(row["CRASH TIME"].split(":")[0]);
        attributes.forEach(attr => {
            let value = parseFloat(row[attr]);
            if (!isNaN(value)) {
                timeAttributesCounts[attr][time] += value;
            }
        });
    });

    return timeAttributesCounts;
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
    const svg = d3.select("#boroughs")
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight);

    const projection = d3.geoMercator().fitSize([dimensions.svgWidth, dimensions.svgHeight], geoData);
    const path = d3.geoPath().projection(projection);

    const paths = svg.selectAll("path")
        .data(geoData.features);

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


function drawTimesChart(timeCounts, dimensions) {
    d3.select("#times").selectAll("*").remove();
    
    const svg = d3.select("#times")
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight);

    const chartWidth = dimensions.svgWidth - dimensions.margin.left - dimensions.margin.right;
    const chartHeight = dimensions.svgHeight - dimensions.margin.top - dimensions.margin.bottom;

    const xScale = d3.scaleLinear()
        .domain([0, 23])
        .range([0, chartWidth]);

    let maxCount = Math.max(...attributes.map(attr => d3.max(Object.values(timeCounts[attr]))));

    const yScale = d3.scaleLinear()
        .domain([0, maxCount])
        .nice()
        .range([chartHeight, 0]);

    const xAxis = d3.axisBottom(xScale).tickFormat(d => `${d}:00`);
    const yAxis = d3.axisLeft(yScale);

    const chartGroup = svg.selectAll(".chartGroup")
        .data([0])
        .join("g")
        .attr("class", "chartGroup")
        .attr("transform", `translate(${dimensions.margin.left},${dimensions.margin.top})`);

    chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis);

    chartGroup.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

    attributes.forEach((attr, index) => {
        const timeData = Object.entries(timeCounts[attr]).map(d => [parseInt(d[0]), d[1]]);
        const color = d3.schemeCategory10[index % 10];
        const line = d3.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(d[1]));

        const pathClass = "linePath-" + attr;

        const path = chartGroup.selectAll("." + pathClass)
            .data([timeData]);

        path.enter()
            .append("path")
            .attr("class", pathClass)
            .merge(path)
            .transition()
            .duration(1000)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("d", line)

        path.exit().remove();
    });
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

    const labelThreshold = 1000;

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

    // Create scales
    let yScale = d3.scaleBand()
        .domain(filteredVehicles.map(d => d.type))
        .rangeRound([0, height])
        .padding(0.1);

    let xScale = d3.scaleLinear()
        .domain([0, d3.max(filteredVehicles, d => d.count)])
        .range([0, width]);

    // Add bars
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

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
};


// d3.csv("cleaned_crash_data_zipc.csv").then(data => {

//     var svgWidth = 600, svgHeight = 400;
//     var padding = { top: 20, right: 40, bottom: 30, left: 50 };

//     // Create SVG element
//     var svg = d3.select('#funny') // This should be the selector to the element where you want to append the SVG
//         .attr('width', svgWidth)
//         .attr('height', svgHeight);

//     // Set up scales
//     var xScale = d3.scaleLinear()
//         .domain(d3.extent(data, function (d) { return d.LONGITUDE; }))
//         .range([padding.left, svgWidth - padding.right]);

//     var yScale = d3.scaleLinear()
//         .domain(d3.extent(data, function (d) { return d.LATITUDE; }))
//         .range([svgHeight - padding.bottom, padding.top]);

//     // Add X axis
//     svg.append('g')
//         .attr('transform', 'translate(0,' + (svgHeight - padding.bottom) + ')')
//         .call(d3.axisBottom(xScale));

//     // Add Y axis
//     svg.append('g')
//         .attr('transform', 'translate(' + padding.left + ',0)')
//         .call(d3.axisLeft(yScale));

//     // Add dots
//     svg.append('g')
//         .selectAll('dot')
//         .data(data)
//         .enter()
//         .append('circle')
//         .attr('cx', function (d) { return xScale(d.LONGITUDE); })
//         .attr('cy', function (d) { return yScale(d.LATITUDE); })
//         .attr('r', 3) // Radius of the dots
//         .style('fill', '#69b3a2');
// });