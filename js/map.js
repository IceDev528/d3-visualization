// Map and projection
var path = d3.geoPath();

// Data and color scale
var populationData = new Array()
var deathData = new Array();
var populationDataRange, deathDataRange;
var yearsFrom, yearsTo;
var mapSvg, bubbleSvg;
var map_data;
var colorScale = d3.scaleThreshold()
  .domain([0.001, 0.002, 0.005, 0.01, 0.02, 0.05])
  .range(d3.schemeGreys[7]);

var country_code = {
  "Brunei Darussalam": "BRN",
  "Malaysia": "MYS",
  "Thailand": "THA",
  "Philippines": "PHL",
  "Singapore": "SGP",
}

var bubble_dataset, bubble_node;

var tooltip = d3.select("body").append("div") 
    .attr("class", "tooltip")       
    .style("opacity", 0);

d3.queue()
  .defer(d3.json, "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
  .defer(d3.csv, "data/population.csv", function(d) { populationData.push(d) })
  .defer(d3.csv, "data/death2.csv", function(d) { deathData.push(d) })
  .await(ready);

function ready(error, data) {
  map_data = data.features  

  /////////////MAP///////////////
  mapSvg = d3.select("#d3-map"),
    width = +mapSvg.attr("width"),
    height = +mapSvg.attr("height");
  var projection = d3.geoMercator()
            .scale(width)
            .center([110,10])
            .translate([width / 2, height / 2]);
  mapSvg = mapSvg.append("g")
    .selectAll("path")
    .data(map_data)
    .enter()
    .append("path")
      // draw each country
      .attr("d", d3.geoPath()
        .projection(projection)
      )   
      .style("stroke", "#fff")

  /////////////BUBBLE///////////////
  var minYear = d3.min(deathData, function(d) { return +d.Year; })
  var maxYear = d3.max(deathData, function(d) { return +d.Year; })
  yearsFrom = minYear
  yearsTo = maxYear

  $( function() {
    $( "#slider-range" ).slider({
      range: true,
      min: minYear,
      max: maxYear,
      values: [ minYear, maxYear ],
      slide: function( event, ui ) {
        yearsFrom = ui.values[0]
        yearsTo = ui.values[1]

        updateData()
        $( "#years" ).val( ui.values[ 0 ] + " - " + ui.values[ 1 ] );
      }
    });
    $( "#years" ).val( $( "#slider-range" ).slider( "values", 0 ) +  
      " - " + $( "#slider-range" ).slider( "values", 1 ) );

    $( "#country-select").change(function(event) {
      changeCountry();
    })
  });

  updateData()
}

function updateData() {
  populationDataRange = populationData.filter(function(e) { return e.Year>=yearsFrom && e.Year<=yearsTo})
  deathDataRange = deathData.filter(function(e) { return e.Year>=yearsFrom && e.Year<=yearsTo})
  updateMapData()
  updateLineChart()  
  changeCountry()
}

function changeCountry() {
  updateBubble() 
  updateStackedBar()
  updateNormalBar()
  updatePieChart()
}

function updateMapData() {
  if(!map_data)
    return;

  map_data.map(function(d) {
    d.population = d3.sum(populationDataRange.filter( (pol) => country_code[pol.Country] == d.id ), e => e["Population at all ages"]) || 0
    d.death = d3.sum(deathDataRange.filter( (death) => country_code[death.Country] == d.id ), e => e["Deaths at all ages"]) || 0
  })
    // Give these new data to update line
    mapSvg
        .data(map_data)
        .attr("fill", function (d) {
          var rate = d.population === 0 ? 0 : d.death / d.population
          return colorScale(rate);
        })
        .on("mouseover", function(d) {    
          var tooltipText = ""
          if( d.population === 0 ) {
          } else {
            var rate = d.death / d.population
            tooltipText = getCountryByCode(d.id) + "</br>Rate: " + (rate * 100).toFixed(3)  + "%</br>Death: " + d.death

            tooltip.transition()    
                .duration(200)    
                .style("opacity", .9);    
            tooltip .html(tooltipText)  
                .style("left", (d3.event.pageX) + "px")   
                .style("top", (d3.event.pageY - 28) + "px");  
          }
        })          
        .on("mouseout", function(d) {   
          tooltip.transition()    
              .duration(500)    
              .style("opacity", 0); 
        })        
        .transition()
        .duration(2000);
}

function updateBubble() {
  var country = $("#country-select").val()
  var causeData = new Array();
  deathDataRange.map(function(e) { 
    if(e.Country === country) {
      causeData[e["Cause"]] = +e["Deaths at all ages"] + (causeData[e["Cause"]] ? causeData[e["Cause"]] : 0)
    }
  })

  bubbleSvg = d3.select("#d3-bubble")
      .attr("class", "bubble");

  bubble_dataset = {
    children: []
  }

  Object.keys(causeData).map(function(key) {
    bubble_dataset.children.push({
      Cause: key,
      Count: causeData[key] || 0,
      Color: '#' + parseInt(Math.random() * 0xFFFFFF).toString(16)
    })
  })

  var diameter = 400;
  var duration = 200;
  var delay = 0;
  var color = d3.scaleOrdinal(d3.schemeCategory20);

  var bubble = d3.pack(bubble_dataset)
      .size([diameter, diameter])
      .padding(1.5);

  var nodes = d3.hierarchy(bubble_dataset)
      .sum(function(d) { return d.Count; });
  
  var t = d3.transition()
          .duration(750);
  //JOIN
  var circle = bubbleSvg.selectAll("circle")
      .data(bubble(nodes).descendants());

  var text = bubbleSvg.selectAll("text.textcircle")
      .data(bubble(nodes).descendants());

  //EXIT
  circle.exit()
    .transition(t)
      .attr("r", 1e-6)
      .remove();

  text.exit()
    .transition(t)
      .attr("opacity", 1e-6)
      .remove();

  //UPDATE
  circle
    .transition(t)    
    .filter(function(d){
        return  !d.children
    })
    .attr("r", function(d) {
        return d.r;
    })
      .attr("cx", function(d){ return d.x; })
      .attr("cy", function(d){ return d.y; })

  text
    .transition(t)        
      .filter(function(d){
          return  !d.children
      })
      .text(function(d){ return d.data.Count; })  
      .attr("font-size", function(d){
          return d.r/5;
      })
      .attr("x", function(d){ return d.x; })
      .attr("y", function(d){ return d.y; });

  //ENTER
  circle.enter()
     .filter(function(d){
          return  !d.children
     })
     .append("circle")
      .attr("r", 1e-6)
      .attr("cx", function(d){ return d.x; })
      .attr("cy", function(d){ return d.y; })
      .style("fill", function(d,i) {
          return d.data.Color;
      })
      .on("mouseover", function(d) {    
          var tooltipText = ""
            tooltipText = d.data.Cause + ": " + d.data.Count

            tooltip.transition()    
                .duration(200)    
                .style("opacity", .9);    
            tooltip .html(tooltipText)  
                .style("left", (d3.event.pageX) + "px")   
                .style("top", (d3.event.pageY - 28) + "px");  
        })          
        .on("mouseout", function(d) {   
          tooltip.transition()    
              .duration(500)    
              .style("opacity", 0); 
        })        
    .transition(t)
      .attr("r", function(d){ return d.r })

  text.enter()     
      .filter(function(d){
          return  !d.children
      })
      .append("text")
      .attr("opacity", 1e-6)
      .attr("class", "textcircle")
      .style("text-anchor", "middle")
      .attr("x", function(d){ return d.x; })
      .attr("y", function(d){ return d.y; })
      .attr("font-family",  "Gill Sans", "Gill Sans MT")
      .attr("font-size", function(d){
          return d.r/5;
      })
      .attr("fill", "white")
      .text(function(d){ return d.data.Count; })      
    .transition(t)
      .attr("opacity", 1);


  var nodess = bubble(nodes).descendants()
      .filter(function(d){
          return  !d.children
      }, function(d) {
        return d.className;
      })
      .sort(function(x, y){
       return y.data.Count - x.data.Count;
      })


  bubbleSvg.selectAll('text.textrect').remove()
  bubbleSvg.selectAll('rect').remove()
  //JOIN
  var rect = bubbleSvg.selectAll("rect")
      .data(nodess);

  var textRect = bubbleSvg.selectAll("text.textrect")
      .data(nodess);

  //UPDATE
  rect
    .transition(t)    
    .filter(function(d){
        return  !d.children
    })
    .attr("y", function(d, i) {
      return i * diameter/33 + diameter/50
    })
    .style("fill", function(d) {
        return d.data.Color; 
    });

  textRect
    .transition(t)        
      .filter(function(d){
          return  !d.children
      })
      .text(function(d){
      return d.data.Cause;
      })
      .attr("y", function(d, i) {
        return i * diameter/33 + diameter/50 + diameter/62
      })

  //ENTER
  rect.enter()
     .filter(function(d){
          return  !d.children
     })
     .append("rect")
      .attr("width", diameter/50)
      .attr("height", diameter/50)
      .attr("y", function(d, i) {
        return i * diameter/33 + diameter/50
      })
      .attr("x", 400)
      .style("fill", function(d) {
          return d.data.Color; 
      });

  textRect.enter()     
      .filter(function(d){
          return  !d.children
      })
      .append("text") 
      .attr("class", "textrect")
      .text(function(d){
      return d.data.Cause;
      })
      .style("font-size", diameter/50)
      .attr("y", function(d, i) {
        return i * diameter/33 + diameter/50 + diameter/62
      })
      .attr("x", 400 + diameter/33)

  d3.select(self.frameElement)
      .style("height", diameter + "px");
}


function updateStackedBar() {
  var country = $("#country-select").val()

  var svg = d3.select("#d3-stacked");
    svg.selectAll('*').remove();
    margin = {top: 20, right: 20, bottom: 30, left: 40}
    width = +svg.attr("width") - margin.left - margin.right
    height = +svg.attr("height") - margin.top - margin.bottom
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  var data = [
    { Age: '0-9', total: 0},
    { Age: '10-19', total: 0},
    { Age: '20-29', total: 0},
    { Age: '30-39', total: 0},
    { Age: '40-49', total: 0},
    { Age: '50-59', total: 0},
    { Age: '60-69', total: 0},
    { Age: '70-79', total: 0},
    { Age: '80-89', total: 0},
    { Age: '90-', total: 0},
  ];
  var keys = d3.map(deathDataRange, function(d){return(d.Cause)}).keys()

  deathDataRange.map(function(e) { 
    if(e.Country === country) {
      if(e.Cuase !== 'All cause') {
        data[0][e.Cause] = +e["Deaths at age 0 year"] + (+e["Deaths at age 1 year"]) + (+e["Deaths at age 2 year"]) + (+e["Deaths at age 3 year"]) 
                                + (+e["Deaths at age 4 year"]) + (+e["Deaths at age 5-9 years"]) + (data[0][e.Cause] ? data[0][e.Cause] : 0)
        data[1][e.Cause] = +e["Deaths at age 10-14 years"] + (+e["Deaths at age 15-19 years"]) + (data[1][e.Cause] ? data[1][e.Cause] : 0)
        data[2][e.Cause] = +e["Deaths at age 20-24 years"] + (+e["Deaths at age 25-29 years"]) + (data[2][e.Cause] ? data[2][e.Cause] : 0)
        data[3][e.Cause] = +e["Deaths at age 30-34 years"] + (+e["Deaths at age 35-39 years"]) + (data[3][e.Cause] ? data[3][e.Cause] : 0)
        data[4][e.Cause] = +e["Deaths at age 40-44 years"] + (+e["Deaths at age 45-49 years"]) + (data[4][e.Cause] ? data[4][e.Cause] : 0)
        data[5][e.Cause] = +e["Deaths at age 50-54 years"] + (+e["Deaths at age 55-59 years"]) + (data[5][e.Cause] ? data[5][e.Cause] : 0)
        data[6][e.Cause] = +e["Deaths at age 60-64 years"] + (+e["Deaths at age 65-69 years"]) + (data[6][e.Cause] ? data[6][e.Cause] : 0)
        data[7][e.Cause] = +e["Deaths at age 70-74 years"] + (+e["Deaths at age 75-79 years"]) + (data[7][e.Cause] ? data[7][e.Cause] : 0)
        data[8][e.Cause] = +e["Deaths at age 80-84 years"] + (+e["Deaths at age 85-89 years"]) + (data[8][e.Cause] ? data[8][e.Cause] : 0)
        data[9][e.Cause] = +e["Deaths at age 90-94 years"] + (+e["Deaths at age 95 years and above"]) + (data[9][e.Cause] ? data[9][e.Cause] : 0)

        data[0][e.Cause] = isNaN(data[0][e.Cause]) ? 0 : data[0][e.Cause]
      }
    }
  })

  for(var i = 0; i < 10; i++) {
    var sum = 0;
    for(let j = 0; j < keys.length; j++) {   
      if( data[i][keys[j]] === undefined ) 
        data[i][keys[j]] = 0
      sum = sum + data[i][keys[j]]
    }

    data[i].total = sum
  }

  var x = d3.scaleBand()
    .rangeRound([0, width])
    .paddingInner(0.05)
    .align(0.1);

  // set y scale
  var y = d3.scaleLinear()
      .rangeRound([height, 0]);

  var colors = [];
  for(var i = 0; i < keys.length; i++) {
    colors.push('#' + parseInt(Math.random() * 0xFFFFFF).toString(16))
  }
  // set the colors
  var z = d3.scaleOrdinal()
      .range(colors);

// load the csv and create the chart
  //var keys = 
  //data.sort(function(a, b) { return b.total - a.total; });
  x.domain(data.map(function(d) { return d.Age; }));
  y.domain([0, d3.max(data, function(d) { return d.total; })]).nice();
  z.domain(keys);

  g.append("g")
    .selectAll("g")
    .data(d3.stack().keys(keys)(data))
    .enter().append("g")
      .attr("fill", function(d) { return z(d.key); })
    .selectAll("rect")
    .data(function(d) { return d; })
    .enter().append("rect")
      .attr("x", function(d) { return x(d.data.Age); })
      .attr("y", function(d) { return y(d[1]); })
      .attr("height", function(d) { return y(d[0]) - y(d[1]); })
      .attr("width", x.bandwidth())
    .on("mouseover", function() { tooltip.style("display", null); })
    .on("mouseout", function() { tooltip.style("display", "none"); })
    .on("mousemove", function(d) {
      var xPosition = d3.mouse(this)[0] - 5;
      var yPosition = d3.mouse(this)[1] - 5;
      tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");
      tooltip.select("text").text(d[1]-d[0]);
    });

  g.append("g")
      .attr("class", "xaxis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  g.append("g")
      .attr("class", "yaxis")
      .call(d3.axisLeft(y).ticks(null, "s"))
    .append("text")
      .attr("x", 2)
      .attr("y", y(y.ticks().pop()) + 0.5)
      .attr("dy", "0.32em")
      .attr("fill", "#000")
      .attr("font-weight", "bold")
      .attr("text-anchor", "start");


      /*
  var legend = g.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "end")
    .selectAll("g")
    .data(keys.slice().reverse())
    .enter().append("g")
      .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

  legend.append("rect")
      .attr("x", width - 19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", z);

  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text(function(d) { return d; });
  */
  // Prep the tooltip bits, initial display is hidden
  var tooltip = svg.append("g")
    .attr("class", "tooltip")
    .style("display", "none");
      
  tooltip.append("rect")
    .attr("width", 60)
    .attr("height", 20)
    .attr("fill", "white")
    .style("opacity", 0.5);

  tooltip.append("text")
    .attr("x", 30)
    .attr("dy", "1.2em")
    .style("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold");
}


function updateNormalBar() {
  var country = $("#country-select").val()
  var causeData = new Array();
  deathDataRange.map(function(e) { 
    if(e.Country === country) {
      causeData[e["Cause"]] = +e["Deaths at all ages"] + (causeData[e["Cause"]] ? causeData[e["Cause"]] : 0)
    }
  })

  data = []

  Object.keys(causeData).map(function(key) {
    data.push({
      Cause: key,
      Count: causeData[key] || 0,
      Color: '#' + parseInt(Math.random() * 0xFFFFFF).toString(16)
    })
  })

  data.sort((a, b) => {
    return b.Count - a.Count;
  })

  var topData = data.slice(1, 6);
  var bottomData = data.slice(data.length - 5);

  var svgBar1 = d3.select("#d3-bar1");
   svgBar1.selectAll('*').remove()
    margin = {top: 50, right: 20, bottom: 40, left: 150}
    width = +svgBar1.attr("width") - margin.left - margin.right
    height = +svgBar1.attr("height") - margin.top - margin.bottom
    g = svgBar1.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
 
  const t = d3.transition()
      .duration(750);

    // Y axis
    var y = d3.scaleBand()
      .range([ 0, height ])
      .domain(topData.map(function(d) { return d.Cause; }))
      .padding(0.2);
    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y))


    // Add X axis
    var x = d3.scaleLinear()
      .domain([0, d3.max(topData, function(d) { return d.Count; })]).nice()
      .rangeRound([ width, 0 ])
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisTop(x))
      .selectAll("text")
      .attr("transform", "translate(10, 20)rotate(-45)")
      .style("text-anchor", "end");

    g.append("text")
        .attr("x", (width / 2))             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px") 
        .style("text-decoration", "underline")  
        .text("Top 5 Categories of Death");

    // Bars
    g.selectAll("mybar")
      .data(topData)
      .enter()
      .append("rect")
        .attr("y", function(d) { return y(d.Cause); })
        .attr("height", y.bandwidth())
        .attr("fill", "#69b3a2")
        // no bar at the beginning thus:
        .attr("width", function(d) { return  width - x(d.Count); }) // always equal to 0
        .attr("x", function(d) { return x(d.Count); })


    // UPDATE section       
    g.selectAll("rect")
      .transition()
      .duration(800)
      .attr("x", function(d) { return x(d.Count); })
      .attr("width", function(d) { return width - x(d.Count); })
      .delay(function(d,i){ return(i*100)})


  ///////////////////////////////////////////////////
  var svgBar2 = d3.select("#d3-bar2");
   svgBar2.selectAll('*').remove()
    margin = {top: 50, right: 20, bottom: 40, left: 150}
    width = +svgBar2.attr("width") - margin.left - margin.right
    height = +svgBar2.attr("height") - margin.top - margin.bottom
    g = svgBar2.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
 
    // Y axis
    var y = d3.scaleBand()
      .range([ 0, height ])
      .domain(bottomData.map(function(d) { return d.Cause; }))
      .padding(0.2);
    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y))


    // Add X axis
    var x = d3.scaleLinear()
      .domain([0, d3.max(bottomData, function(d) { return d.Count; })]).nice()
      .rangeRound([ 0, width ])
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisTop(x))
      .selectAll("text")
      .attr("transform", "translate(10, 20)rotate(-45)")
      .style("text-anchor", "end");

    g.append("text")
        .attr("x", (width / 2))             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px") 
        .style("text-decoration", "underline")  
        .text("Bottom 5 Categories of Death");

    // Bars
    g.selectAll("mybar")
      .data(bottomData)
      .enter()
      .append("rect")
        .attr("y", function(d) { return y(d.Cause); })
        .attr("height", y.bandwidth())
        .attr("fill", "#69b3a2")
        // no bar at the beginning thus:
        .attr("width", function(d) { return x(d.Count); }) // always equal to 0
        .attr("x", function(d) { return 1 })


    // UPDATE section       
    g.selectAll("rect")
      .transition()
      .duration(800)
      .attr("x", function(d) { return 1 })
      .attr("width", function(d) { return x(d.Count); })
      .delay(function(d,i){ return(i*100)})
}

function updatePieChart() {
  var country = $("#country-select").val()
  var causeData = new Array();
  deathDataRange.map(function(e) { 
    if(e.Country === country) {
      causeData[e["Sex"]] = +e["Deaths at all ages"] + (causeData[e["Sex"]] ? causeData[e["Sex"]] : 0)
    }
  })

  var data = []
  var _all = causeData["Male"] + causeData["Female"]
  causeData["Male"] = causeData["Male"] * 100 / _all 
  causeData["Female"] = causeData["Female"] * 100 / _all 
  data.push(causeData["Male"]);
  data.push(causeData["Female"]);

  var svg = d3.select("#d3-pie");
  width = svg.attr('width')
  height = svg.attr('height')
  var radius = Math.min(width, height) / 3;

  var color = d3.scaleOrdinal()
    .range(["#d62728", "#2ca02c"]);
  var arc = d3.arc()
    .outerRadius(radius - 10)
    .innerRadius(0);

  var labelArc = d3.arc()
      .outerRadius(radius - 40)
      .innerRadius(radius - 40);
  var pie = d3.pie()
    .sort(null)
    .value(function(d) { return d; });


    var gmain = svg.append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var g = gmain.selectAll(".arc")
        .data(pie(data))
        .enter().append("g")
        .attr("class", "arc");

    g.append("path")
        .attr("d", arc)
        .style("fill", function(d) { return color(d.data) });

    g.append("text")
        .attr("transform", function(d) { return "translate(" + labelArc.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .text(function(d) {  return d.value.toFixed(2) + "%"; });

  var legendT = ['Male', 'Female']

  var legend = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 16)
      .attr("text-anchor", "end")
    .selectAll("g")
    .data(legendT)
    .enter().append("g")
      .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

  legend.append("rect")
      .attr("x", width - 19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", function(d, i) { return color(i) });

  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text(function(d) { return d; });

}

function updateLineChart() {
  var causeData = new Array();
  deathDataRange.map(function(e) {     
    if( causeData[e.Country] === undefined )
      causeData[e.Country] = {}

    causeData[e.Country][e.Year] = +e["Deaths at all ages"] + (causeData[e.Country][e.Year] ? causeData[e.Country][e.Year] : 0)
  })

  
  data = []

  Object.keys(causeData).map(function(countries) {
    Object.keys(causeData[countries]).map(function(key) {
      data.push({
        country: countries,
        date: +key,
        count: +causeData[countries][key] || 0
      })
    })
  })
  
  var svg = d3.select("#d3-line")
  
  svg.selectAll('*').remove()
  var margin = {top: 20, right: 20, bottom: 70, left: 70},  
  width = svg.attr('width')
  height = svg.attr('height')
  width = width - margin.left - margin.right,
  height = height - margin.top - margin.bottom
  var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  // Set the ranges
  var x = d3.scaleLinear().range([0, width]);  
  var y = d3.scaleLinear().range([height, 0]);

  // Define the line
  var priceline = d3.line()	
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.count); });
  // set the ranges
  

  x.domain(d3.extent(data, function(d) { return d.date; }));
  y.domain([0, d3.max(data, function(d) { return d.count; })]);

    // Nest the entries by symbol
    var dataNest = d3.nest()
        .key(function(d) {return d.country;})
        .entries(data);

    // set the colour scale
    var color = d3.scaleOrdinal(d3.schemeCategory10);

    legendSpace = width/dataNest.length; // spacing for the legend

    // Loop through each symbol / key
    dataNest.forEach(function(d,i) { 
      g.append("path")
            .attr("class", "line")
            .style("stroke", function() { // Add the colours dynamically
                return d.color = color(d.key); })
            .attr("d", priceline(d.values));

        // Add the Legend
        g.append("text")
            .attr("x", (legendSpace/2)+i*legendSpace)  // space legend
            .attr("y", height + (margin.bottom/2)+ 5)
            .attr("class", "legend")    // style the legend
            .style("fill", function() { // Add the colours dynamically
                return d.color = color(d.key); })
            .text(d.key); 

    });

  // Add the X Axis
  g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  // Add the Y Axis
  g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y));

}

function getCountryByCode(code) {
  return Object.keys(country_code).find(key => country_code[key] === code);
}
