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

let selectedVehicles = [];

const allVehicleTypes = [
    "Sedan", "Station wagon", "Sport utility vehicle / Mini van", "Bike",
    "E-bike/E-scooter", "Box truck", "Bus", "Pick-up truck", "Taxi",
    "Motorcycle", "Ambulance"
]

const vehicleColorScale = {
    "Sedan": "#1f77b4",
    "Station wagon": "#ff7f0e",
    "Sport utility vehicle / Mini van": "#2ca02c",
    "Bike": "#d62728",
    "E-bike/E-scooter": "#9467bd",
    "Box truck": "#8c564b",
    "Bus": "#e377c2",
    "Pick-up truck": "#7f7f7f",
    "Taxi": "#bcbd22",
    "Motorcycle": "#17becf",
    "Ambulance": "#9edae5"
};



d3.csv("cleaned_crash_data_zipc.csv").then(data => {
    globdata = data
    d3.json("Borough_Boundaries.geojson").then(geoData => {
        globgeodata = geoData
        updateVisualization(globdata)
    });
});

function updateVisualization(data) {
    if (isCombinedVisualization) {
        drawBoroughsChart(bouroughCount(data), colorScale);
    }
    else {
        drawIndividChart(data)
    }


    let filteredVehicles = vehiclesCount(data);

    if (selectedVehicles.length >= 2) {
        drawPies(factorsCount(data), data)
    }
    else {
        drawBubbles(factorsCount(data));
    }
    drawVehiclesChart(filteredVehicles);

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

    allVehicleTypes.forEach(type => vehicleCounts[type] = 0);

    data.forEach(row => {
        let type1 = row["VEHICLE TYPE CODE 1"];
        let type2 = row["VEHICLE TYPE CODE 2"];

        if (type1 && vehicleCounts.hasOwnProperty(type1)) {
            vehicleCounts[type1]++;
        }
        if (type2 && vehicleCounts.hasOwnProperty(type2)) {
            vehicleCounts[type2]++;
        }
    });

    let filteredVehicles = Object.entries(vehicleCounts)
        .map(([type, count]) => ({ type, count }));

    // Sort if necessary
    filteredVehicles.sort((a, b) => b.count - a.count);

    return filteredVehicles;
}

function drawBoroughsChart(boroughCounts, colorScale) {

    var dimensions = {
        svgWidth: 500,
        svgHeight: 500,
        margin: {
            top: 20,
            right: 20,
            bottom: 40,
            left: 40
        }
    };

    d3.select('#boroughs').selectAll("*").remove();

    const svg = d3.select("#boroughs")
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight);

    const projection = d3.geoMercator().fitSize([dimensions.svgWidth, dimensions.svgHeight], globgeodata);
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

function drawPies(factorCounts, data) {
    d3.select('#bubbles').selectAll("*").remove();

    var dimensions = { svgWidth: 600, svgHeight: 600, margin: { top: 50, right: 50, bottom: 50, left: 100 } };
    const svg = d3.select('#bubbles')
        .attr('width', dimensions.svgWidth)
        .attr('height', dimensions.svgHeight);

    let maxCount = d3.max(Object.values(factorCounts));
    let labelThreshold = maxCount * 0.05;
    let radiusScale = d3.scaleSqrt().domain([0, maxCount]).range([10, 100]);

    var pie = d3.pie().value(d => d.count);
    var arc = d3.arc().innerRadius(0);

    let factors = Object.keys(factorCounts).map(factor => {
        let vehicleCounts = selectedVehicles.reduce((acc, vehicle) => {
            acc[vehicle] = countVehicleForFactor(data, vehicle, factor);
            return acc;
        }, {});

        return {
            factor: factor,
            count: factorCounts[factor],
            vehicles: pie(Object.entries(vehicleCounts).map(([type, count]) => ({ type, count })))
        };
    });

    let factorGroups = svg.selectAll(".factor-group")
        .data(factors, d => d.factor)
        .enter()
        .append("g")
        .attr("class", "factor-group")
        .each(function (d) {
            var group = d3.select(this);
            group.selectAll('path')
                .data(d.vehicles)
                .enter().append('path')
                .attr('d', arc.outerRadius(radiusScale(d.count)))
                .attr('fill', d => vehicleColorScale[d.data.type]);

            group.on('mouseover', (event, d) => {
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
        });
    
    factorGroups.append("text")
            .filter(d => d.count >= labelThreshold)
            .text(d => d.factor)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "10px")
            .attr("fill", "black");

    let simulation = d3.forceSimulation(factors)
        .force("charge", d3.forceManyBody().strength(15))
        .force("center", d3.forceCenter(dimensions.svgWidth / 2, dimensions.svgHeight / 2))
        .force("collision", d3.forceCollide().radius(d => radiusScale(d.count) + 1))
        .on("tick", ticked);

    function ticked() {
        factorGroups.attr("transform", d => `translate(${d.x},${d.y})`);
    }
}

function countVehicleForFactor(data, vehicle, factor) {
    return data.filter(row => 
        (row["CONTRIBUTING FACTOR VEHICLE 1"] === factor || row["CONTRIBUTING FACTOR VEHICLE 2"] === factor) &&
        (row["VEHICLE TYPE CODE 1"] === vehicle || row["VEHICLE TYPE CODE 2"] === vehicle)
    ).length;
}

function drawBubbles(factorCounts) {

    d3.select('#bubbles').selectAll("*").remove();

    var dimensions = { svgWidth: 600, svgHeight: 600, margin: { top: 50, right: 50, bottom: 50, left: 100 } };
   
    const svg = d3.select('#bubbles')
        .attr('width', dimensions.svgWidth)
        .attr('height', dimensions.svgHeight);

    let factors = Object.keys(factorCounts).map(key => ({ factor: key, count: factorCounts[key] }));
    let maxCount = d3.max(factors, d => d.count);
    let radiusScale = d3.scaleSqrt().domain([0, maxCount]).range([10, 100]);
    let labelThreshold = maxCount * 0.05;

    var factorGroups = svg.selectAll(".factor-group")
        .data(factors, d => d.factor)
        .enter()
        .append("g")
        .attr("class", "factor-group");

    factorGroups.append("circle")
        .attr("r", d => radiusScale(d.count))
        .attr("fill", "lightgrey")
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

        factorGroups.append("text")
            .filter(d => d.count >= labelThreshold)
            .text(d => d.factor)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "10px")
            .attr("fill", "black");
            
        
        let simulation = d3.forceSimulation(factors)
            .force("charge", d3.forceManyBody().strength(15))
            .force("center", d3.forceCenter(dimensions.svgWidth / 2, dimensions.svgHeight / 2))
            .force("collision", d3.forceCollide().radius(d => radiusScale(d.count) + 1))
            .on("tick", ticked);

        function ticked() {
            factorGroups.attr("transform", d => `translate(${d.x},${d.y})`);
        }
}

function drawVehiclesChart(filteredVehicles) {

    var dimensions = {
        svgWidth: 1450,
        svgHeight: 170,
        margin: {
            top: 20, right: 20, bottom: 30, left: 150
        },
        width: 1450 - (150 + 20),
        height: 170 - (20 + 30)
    };

    d3.select('#barchart').selectAll("*").remove();

    const svg = d3.select('#barchart')
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight)
        .append("g")
        .attr("transform", `translate(${dimensions.margin.left},${dimensions.margin.top})`);

    let xScale = d3.scaleBand()
        .domain(filteredVehicles.map(d => d.type))
        .rangeRound([0, dimensions.width])
        .padding(0.1);

    let yScale = d3.scaleLinear()
        .domain([0, d3.max(filteredVehicles, d => d.count)])
        .range([dimensions.height, 0]);

    svg.selectAll(".bar")
        .data(filteredVehicles)
        .enter().append("rect")
        .attr("class", "bar hover-border")
        .attr("x", d => xScale(d.type))
        .attr("y", d => yScale(d.count))
        .attr("width", xScale.bandwidth())
        .attr("height", d => dimensions.height - yScale(d.count))
        .attr("fill", d => vehicleColorScale[d.type])
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
            selectedVehicles.push(d.type);
            filterDataByVehicle(d.type)
        });

    svg.append("g")
        .call(d3.axisBottom(xScale))
        .attr("transform", `translate(0,${dimensions.height})`);

    svg.append("g")
        .call(d3.axisLeft(yScale));
};

function drawIndividChart(indivdata) {

    var dimensions = {
        svgWidth: 500,
        svgHeight: 500,
        margin: {
            top: 20,
            right: 20,
            bottom: 40,
            left: 40
        }
    };

    d3.select('#boroughs').selectAll("*").remove();

    var svg = d3.select('#boroughs')
        .attr("width", dimensions.svgWidth)
        .attr("height", dimensions.svgHeight)

    var xScale = d3.scaleLinear()
        .domain(d3.extent(indivdata, function (d) { return d.LONGITUDE; }))
        .range([dimensions.margin.left, dimensions.svgWidth - dimensions.margin.right]);

    var yScale = d3.scaleLinear()
        .domain(d3.extent(indivdata, function (d) { return d.LATITUDE; }))
        .range([dimensions.svgHeight - dimensions.margin.bottom, dimensions.margin.top]);

    svg.append('g')
        .attr('transform', 'translate(0,' + (dimensions.svgHeight - dimensions.margin.bottom) + ')')
        .call(d3.axisBottom(xScale));

    svg.append('g')
        .attr('transform', 'translate(' + dimensions.margin.left + ',0)')
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
        drawBoroughsChart(bouroughCount(globdata), colorScale);
    } else {
        button.classList.remove("active");
        buttonText.textContent = "Show Boroughs Visualization";
        drawIndividChart(globdata);
    }
}

document.getElementById("toggleButton").addEventListener("click", toggleVisualization);
