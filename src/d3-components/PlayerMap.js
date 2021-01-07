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

        const { width, height, mapColor, geoData, teamData, playerData } = props;
        // console.log(props);

        this.weightScale = d3.scaleLinear()
            .domain(d3.extent(playerData, (d) => d.salary))
            .range([1,100])

        const maxCircleRadius = 57;
        this.voronoiRadius = d3.scaleLinear()
            .domain([0, 350])
            .range([0, maxCircleRadius])
        
        console.log(this.weightScale(39219565))
        console.log(this.voronoiRadius(this.weightScale(39219565)))

        this.svg = d3.select(containerEl)
            .append("svg")
            .attr("viewBox", [0, 0, width, height]);

        const defs = this.svg.append('svg:defs');
        defs.selectAll(".player-photo")
            .data(playerData, d => d.player_id)
            .enter()
                .append("svg:pattern")
                .attr("class", "player-photo")
                .attr("id", d => `${d.player_id}-photo`)
                .attr("height", 1)
                .attr("width", 1)
                .attr("patternUnits", "objectBoundingBox")
                .append("svg:image")
                    .attr("xlink:href", d => `images/${d.player_id}.png`)
                    // Found the ratio of salary to polygon area, per unit of circle radius range (~159), then took sqrt to get length of one side (width)
                    .attr("width", d => Math.sqrt(d.salary / (159.12*maxCircleRadius)))
                    .attr("x", 0)
                    .attr("y", 0);


        const geoJSON = topojson.feature(geoData, geoData.objects.states);

        const projection = d3.geoAlbersUsa()
            .fitExtent([[20, 20], [width-20, height-20]], geoJSON);

        this.generateMap({ geoJSON, projection, mapColor })
        this.generateTeams({ teamData, playerData, projection });
    
    }
    
    generateMap = ({ geoJSON, projection, mapColor }) => {
        geoJSON.features = geoJSON.features.filter(d => !["Alaska", "Hawaii"].includes(d.properties.NAME));

        let path = d3.geoPath()
            .projection(projection);
                
        this.mapPath = this.svg.append("g")
            .attr("class", "background-map")
            .selectAll("path");
        
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
    }
    
    generateTeams = ({ teamData, playerData, projection }) => {
        this.teams = this.svg.append("g")
            .attr("class", "teams");
      
        this.teamGroups = this.teams.selectAll("g")
            .data(teamData, d => d.team_id)
            .enter()
            .append("g")
                .attr("class", d => `team-group ${d.team_id}-group`);

        teamData.forEach((teamData) => {
            const [xCenter, yCenter] = projection([teamData.longitude, teamData.latitude])
            teamData.xCoordinate = xCenter;
            teamData.yCoordinate = yCenter;

            const players = playerData
                .filter((player) => player.team_id === teamData.team_id)
                .map((player) => ({ 
                    weight: this.weightScale(player.salary),
                    player_name: player.player,
                    player_id: player.player_id,
                    team: player.team_id,
                    per: player.per
                }))
            
            const weightSum = players.map((x) => x.weight).reduce((a, b) => a + b, 0);
            teamData.radius = this.voronoiRadius(weightSum);

            this.addTeamTreemap({ teamData, players, projection });
        })

        const tick = () => {
            this.teamGroups
                .style("transform", d => {
                    let dx = d.x - d.xCoordinate
                    let dy = d.y - d.yCoordinate
                    return `translate(${dx}px, ${dy}px)`
                })
        }

        const simulation = d3.forceSimulation()
            .nodes(teamData)
            .force('x', d3.forceX(d => d.xCoordinate).strength(1.0))
            .force('y', d3.forceY(d => d.yCoordinate).strength(1.0))
            .force("charge", d3.forceManyBody())
            .force("collision", d3.forceCollide(d => d.radius + 4))
            .on("tick", tick)
            // .stop()
        
        for (let i =0; i < 500; i++) {
            simulation.tick();
        };
    
    }

    addTeamTreemap = ({ teamData, players, projection }) => {

        // const treemapRadius = 45;
        console.log(players);
        
        const simulation = voronoiMapSimulation(players)
            .prng(seedrandom('randomsed'))
            .clip(getCircleCoordinates(teamData.xCoordinate, teamData.yCoordinate, teamData.radius, 35))
            .stop()                                               

        let state = simulation.state();
        while (!state.ended) {
            simulation.tick();
            state = simulation.state();
        }
        
        let teamGroup = this.teams
            .select(`.${teamData.team_id}-group`);

        let playerPolygons = teamGroup
            .selectAll(".player-polygons")
            .data(state.polygons)
            .enter()
                .append('path')
                .attr("class", "player-polygons")
                .attr('d', (d) => `M${d}z`)
                .style("fill-opacity", 0.95)
                .style("fill", d => teamData.color_1)
                .style("stroke", teamData.color_2)
                .style("stroke-width", "2px");
                // .style('fill', (d) =>  fillScale(d.site.originalObject));
        
        let playerImages = teamGroup
            .selectAll(".player-polygon-images")
            .data(state.polygons)
            .enter()
                .append('path')
                .attr("class", "player-polygon-images")
                .attr('d', (d) => `M${d}z`)
                .style("fill", d => {
                    const player_id = d.site.originalObject.data.originalData.player_id;
                    return `url(#${player_id}-photo)`
                })
                .style("stroke", teamData.color_2)
                .style("stroke-width", "2px");
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