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

        const { width, height, mapColor, geoData, teamData } = props;
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
            .attr("class", "teams");
            // .selectAll(".team-group")
        
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

        let treemapData = [];
        for (let i=0; i < 15; i++ ) {
            treemapData.push({ weight: getRandomInt(10) })
        }

        this.teamGroups = this.teams.selectAll("g")
            .data(teamData, d => d.team_id)
            .enter()
            .append("g")
                .attr("class", d => `team-group ${d.team_id}-group`);

        teamData.forEach((teamData) => {
            const [xCenter, yCenter] = projection([teamData.longitude, teamData.latitude])
            teamData.xCoordinate = xCenter;
            teamData.yCoordinate = yCenter;

            console.log(teamData);
            this.addTeamTreemap({ treemapData, teamData, projection })
        })

        const tick = () => {
            this.teamGroups
                .style("transform", d => {
                    let dx = d.x - d.xCoordinate
                    let dy = d.y - d.yCoordinate
                    console.log(d.x, d.xCoordinate)
                    return `translate(${dx}px, ${dy}px)`
                })
        }

        const simulation = d3.forceSimulation()
            .nodes(teamData)
            .force('x', d3.forceX(d => d.xCoordinate).strength(1.0))
            .force('y', d3.forceY(d => d.yCoordinate).strength(1.0))
            .force("charge", d3.forceManyBody())
            .force("collision", d3.forceCollide(55))
            .on("tick", tick)
    
    }

    addTeamTreemap = ({ treemapData, teamData, projection }) => {

        const treemapRadius = 50;
        
        const simulation = voronoiMapSimulation(treemapData)
            // .prng(seedrandom('seed'))
            .clip(getCircleCoordinates(teamData.xCoordinate, teamData.yCoordinate, treemapRadius, 30))
            .stop()                                               

        let state = simulation.state();

        while (!state.ended) {
            simulation.tick();
            state = simulation.state();
        }

        const polygons = state.polygons;   
        
        let teamGroup = this.teams
            .select(`.${teamData.team_id}-group`);
        
        let playerPolygons = teamGroup
            .selectAll(".player-polygons")
            .data(polygons)
            .enter()
                .append('path')
                .attr("class", "player-polygons")
                .attr('d', (d) => "M" + d + "z")
                .style("fill", teamData.color_1)
                .style("stroke", teamData.color_2)
                .style("stroke-width", "3px");
                // .style('fill', (d) =>  fillScale(d.site.originalObject));
        
    }

    updateMapColor = ({ opacity, mapColor }) => { 
        this.mapPath
            .transition()
            // .duration(300)
            .style("fill-opacity", opacity)
            .style("fill", mapColor);
    }
  
    resize = (width, height) => { /*...*/ }
    
  }
  
  export default PlayerMap;