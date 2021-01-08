import * as d3 from "d3";
import * as topojson from "topojson-client";
import { voronoiMapSimulation } from 'd3-voronoi-map';
import seedrandom from 'seedrandom';


const getRandomInt = (max) => Math.floor(Math.random() * Math.floor(max));

const generateCirclePath = (cx, cy, r) => {
  return "M" + cx + "," + cy + " " +
         "m" + -r + ", 0 " +
         "a" + r + "," + r + " 0 1,0 " + r*2  + ",0 " +
         "a" + r + "," + r + " 0 1,0 " + -r*2 + ",0Z";
};

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

        this.maxCircleRadius = 57;
        this.voronoiRadius = d3.scaleLinear()
            .domain([0, 350])
            .range([0, this.maxCircleRadius])

        this.playerData = playerData.map((player) => ({ 
            weight: this.weightScale(player.salary),
            player_name: player.player,
            player_id: player.player_id,
            team: teamData.find((team) => team.team_id === player.team_id),
            per: player.per,
            salary: player.salary,
            vorp: player.vorp
        }));

        this.teamData = teamData;
 
        this.svg = d3.select(containerEl)
            .append("svg")
            .attr("viewBox", [0, 0, width, height]);

        this.initPlayerPhotos({ playerData })
        
        const geoJSON = topojson.feature(geoData, geoData.objects.states);
        const projection = d3.geoAlbersUsa()
            .fitExtent([[0, 0], [width-20, height-20]], geoJSON);
        this.generateMap({ geoJSON, projection, mapColor });

        this.generateTeamGroups({ projection });

        let allPolygons = [];
        this.teamData.forEach((team) => {
            let players = this.playerData.filter((player) => player.team.team_id === team.team_id);
            let polygons = this.addTeamTreemap({ team, players })
            allPolygons = allPolygons.concat(polygons);
        })

        this.generatePolygons(allPolygons);


        setTimeout(() => {
            let newTeams = ["BOS", "MIA", "DET", "CHI"];
            let affectedTeams = [...newTeams]
            Array(12, 35, 102, 121).forEach((index, i) => {
                console.log(index)
                let oldTeam = this.updateTeam(this.playerData[index].player_id, newTeams[i])
                affectedTeams = affectedTeams.concat(oldTeam)
            })
            affectedTeams = [...new Set(affectedTeams)];
            

            // this.playerData[12].team = teamData.find((team) => team.team_id === "BOS");
            // this.playerData[35].team = teamData.find((team) => team.team_id === "MIA");
            // let affectedTeams = ["MIL", "WAS", "BOS", "MIA"];

            affectedTeams.forEach((team_id) => {
                allPolygons = allPolygons.filter((polygon) => polygon.site.originalObject.data.originalData.team.team_id !== team_id) 
                let team = this.teamData.find((t) => t.team_id === team_id)
                let players = this.playerData.filter((player) => player.team.team_id === team.team_id);
                let polygons = this.addTeamTreemap({ team, players })
                allPolygons = allPolygons.concat(polygons);
            })
    
            this.generatePolygons(allPolygons, affectedTeams);

        }, 5000)


    }

    updateTeam = ( playerId, newTeamId ) => {
        const arrayIndex = this.playerData.findIndex(d => d.player_id === playerId);
        let oldTeam = this.playerData[arrayIndex].team.team_id;
        this.playerData[arrayIndex] = {
            ...this.playerData[arrayIndex],
            team: this.teamData.find(team => team.team_id === newTeamId)
        };
        return oldTeam;
    };

    initPlayerPhotos = ({ playerData }) => {
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
                    .attr("width", d => Math.sqrt(d.salary / (159.12*this.maxCircleRadius)))
                    .attr("x", 0)
                    .attr("y", 0);
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
    
    generateTeamGroups = ({ projection }) => {
        this.teams = this.svg.append("g")
            .attr("class", "teams");
      
        this.teamGroups = this.teams.selectAll("g")
            .data(this.teamData, d => d.team_id)
            .enter()
            .append("g")
                .attr("class", d => `team-group ${d.team_id}-group`);

        this.teamData.forEach((team) => {
            const [xCenter, yCenter] = projection([team.longitude, team.latitude])
            team.xCoordinate = xCenter;
            team.yCoordinate = yCenter;

            const players = this.playerData
                .filter((player) => player.team.team_id === team.team_id);
            const weightSum = players.map((x) => x.weight).reduce((a, b) => a + b, 0);
            team.radius = this.voronoiRadius(weightSum);
            // this.addTeamTreemap({ teamData, players });
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
            .nodes(this.teamData)
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

    addTeamTreemap = ({ team, players }) => {
        let xVal = team.x || team.xCoordinate;
        let yVal = team.y || team.yCoordinate;
        
        const simulation = voronoiMapSimulation(players)
            .prng(seedrandom('randomsed'))
            .clip(getCircleCoordinates(xVal, yVal, team.radius, 35))
            .initialPosition((d) => {
                const polygon = this.svg.select(`#player-polygon-${d.player_id}`)
                return polygon.nodes().length > 0 ?
                    [polygon.data()[0].site.x, polygon.data()[0].site.y] :
                    [undefined, undefined]
            })
            // .initialWeight((d) => {
            //     const polygon = this.svg.select(`#player-polygon-${d.player_id}`)
            //     return polygon.nodes().length > 0 ?
            //         polygon.data()[0].site.weight :
            //         undefined
            // })
            .stop()                                               

        let state = simulation.state();
        while (!state.ended) {
            simulation.tick();
            state = simulation.state();
        }
        
        return state.polygons;
    }

    generatePolygons = (polygons, affectedTeams = []) => {

        let playerPolygons = this.svg
            .selectAll(".player-polygons")
            .data(polygons, d => d.site.originalObject.data.originalData.player_id)
            .join(
                enter => enter.append('path')
                    .attr("class", d => `player-polygons ${d.site.originalObject.data.originalData.team.team_id}-polygon`)
                    .attr("id", d => `player-polygon-${d.site.originalObject.data.originalData.player_id}`)
                    .attr('d', (d) => `M${d.join('L')}z`)
                    .style("fill-opacity", 0.95)
                    .style("fill", d => d.site.originalObject.data.originalData.team.color_1)
                    .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)
                    .style("stroke-width", "2px"),
                update => {     
                    update
                        .transition()
                        .style('opacity', d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id) ? 1.0 : 0.4)
                        .delay(3000)
                        .style('opacity', 1.0)

                    update.filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                        .transition()
                        .duration(3000)
                        .attr('d', (d) => `M${d.join('L')}z`)
                        .style("fill", d => d.site.originalObject.data.originalData.team.color_1)
                        .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)

                    return update;
                }
                // exit => exit.remove()
            )
        
        let playerImages = this.svg
            .selectAll(".player-polygon-images")
            .data(polygons, d => d.site.originalObject.data.originalData.player_id)
            .join(
                enter => { 
                    return enter
                        .append('path')
                        .attr("class", d => `player-polygon-images ${d.site.originalObject.data.originalData.team.team_id}-polygon-image`)
                        .attr("id", d => `player-image-${d.site.originalObject.data.originalData.player_id}`)
                        .attr('d', (d) => `M${d.join('L')}z`)
                        .style("fill", d => {
                            const player_id = d.site.originalObject.data.originalData.player_id;
                            return `url(#${player_id}-photo)`
                        })
                        .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)
                        .style("stroke-width", "2px")
                    // return enter;
                },
                update => {
                    update
                        .transition()
                        .style('opacity', d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id) ? 1.0 : 0.4)
                        .delay(3000)
                        .style('opacity', 1.0);

                    update.filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                        .transition()
                        .duration(3000)
                        .attr('d', (d) => `M${d.join('L')}z`)
                        .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)

                    return update;
                }
                // exit => exit.remove() 
            )        
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


// update
// .transition()
// .duration(2000)
// .attr('d', (d) => `M${d}z`)
// .attr('d', d => {
//     const radius = Math.sqrt(d.site.originalObject.data.originalData.salary / (159.12*57)) / 2;
//     const path = generateCirclePath(d.site.x, d.site.y, radius);
//     return path
// })

// .attr('d', d => {
//     const radius = Math.sqrt(d.site.originalObject.data.originalData.salary / (159.12*57)) / 2;
//     const path = generateCirclePath(d.site.x+20, d.site.y+20, radius);
//     return path
// })