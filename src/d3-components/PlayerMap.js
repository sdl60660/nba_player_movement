import * as d3 from "d3";
import * as topojson from "topojson-client";
import { voronoiMapSimulation } from 'd3-voronoi-map';
import seedrandom from 'seedrandom';


const getRandomInt = (max) => Math.floor(Math.random() * Math.floor(max));

const getCircleCoordinates = (centerX, centerY, radius, sides) => {
    let coordinates = [];
    
    for (var i = 0; i < sides; i++) {
        const coordinate = [
            (centerX + radius * Math.cos(2 * Math.PI * i / sides)),
            (centerY + radius * Math.sin(2 * Math.PI * i / sides))
        ];
        coordinates.push(coordinate)
    }
    
    return coordinates;
}

class PlayerMap {

    containerEl;
    props;
    svg; 
  
    constructor(containerEl, props) {
        this.containerEl = containerEl;
        this.props = props;

        const { width, height, mapColor, geoData } = props;
        console.log(props);

        const geoJSON = topojson.feature(geoData, geoData.objects.states);
        geoJSON.features = geoJSON.features.filter(d => !["Alaska", "Hawaii"].includes(d.properties.NAME));

        const projection = d3.geoAlbersUsa()
            .fitExtent([[20, 20], [width-20, height-20]], geoJSON);

        let path = d3.geoPath()
            .projection(projection);
        
        this.svg = d3.select(containerEl)
            .append("svg")
            .attr("viewBox", [0, 0, width, height]);
                
        this.mapPath = this.svg.append("g")
            .attr("class", "background-map")
            .selectAll("path");
        
        this.teams = this.svg.append("g")
            .attr("class", "team-treemaps")
            .selectAll(".teams")
        
        this.mapPath = this.mapPath.data( geoJSON.features, d => d)
            .join(
                enter => enter.append("path")
                    .attr("d", path)
                    .attr("class", "state-path")
                    .style("opacity", 0.8)
                    .style("stroke","black")
                    .style('stroke-width', 0.5)
                    .style("fill", mapColor)

                // exit => exit.remove()
            );
      
      // init other vis elements like scales and axes here.
        const sampleData = [
            { weight: getRandomInt(10) }, 
            { weight: getRandomInt(10) }, 
            { weight: getRandomInt(10) }, 
            { weight: getRandomInt(10) }, 
            { weight: getRandomInt(10) },
            { weight: getRandomInt(10) }
        ]

        this.addTeamTreemaps({ sampleData })
    }
    
    updateMapColor = ({ opacity, mapColor }) => { 
        this.mapPath
            // .transition()
            // .duration(300)
            .style("fill-opacity", opacity)
            .style("fill", mapColor);
    }

    addTeamTreemaps  = ({ sampleData }) => {
        
        const simulation = voronoiMapSimulation(sampleData)
            // .initialPosition([100, 200])
            .prng(seedrandom('seed'))
            // .weight((d) => weightScale(d))                          
            // .clip([[0,0], [0, 200], [200, 200], [200, 0]])      // set the clipping polygon
            .clip(getCircleCoordinates(200, 200, 75, 30))
            // .initialPosition([1,1])
            .stop()                                               

        let state = simulation.state();                           // retrieve the simulation's state, i.e. {ended, polygons, iterationCount, convergenceRatio}

        while (!state.ended) {                                    // manually launch each iteration until the simulation ends
            simulation.tick();
            state = simulation.state();
        }

        const polygons = state.polygons;                            // retrieve polygons, i.e. cells of the final Voronoï map
        console.log(polygons)

        this.teams.data(polygons)                                    // d3's join
            .enter()                                                // create cells with appropriate shapes and colors
            .append('path')
            .attr("class", "teams")
            .attr('d', (d) => "M" + d + "z")
            .style("fill", "red")
            .style("stroke", "black")
            .style("stroke-width", "3px");
            // .style('fill', (d) =>  fillScale(d.site.originalObject));
        
        this.teams
            // .attr("transform", (d) => 'translate(' + d.x + ' '+ d.y + ')')
            .attr("transform", "translate(100px, 100px)");

        // this.teams
        //     .selectAll()
        //     .data(teamData, d => d)
        //     .join(
        //         enter => enter.append("")
        //             .attr("class", "team-treemap")
                    
        //     )
    }
  
    resize = (width, height) => { /*...*/ }
    
  }
  
  export default PlayerMap;