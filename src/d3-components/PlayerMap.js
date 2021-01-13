// @flow

import * as d3 from 'd3';
import d3Tip from "d3-tip"
import * as topojson from "topojson-client";
import seedrandom from 'seedrandom';
import { groupBy } from 'lodash';
import { voronoiMapSimulation } from 'd3-voronoi-map';


const generateCirclePath = (cx, cy, r) => {
  return "M" + cx + "," + cy + " " +
         "m" + -r + ", 0 " +
         "a" + r + "," + r + " 0 1,0 " + r*2  + ",0 " +
         "a" + r + "," + r + " 0 1,0 " + -r*2 + ",0Z";
};


const getCircleCoordinates = (centerX, centerY, radius, sides) => {
    if (radius === 0) {
        throw Error("Radius may not equal zero")
    }

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

        const { width, height, mapColor, geoData, teamData, playerData, setPlayerData } = props;

        this.svg = d3.select(containerEl)
            .append("svg")
            .attr("viewBox", [0, 0, width, height]);
        
        this.initTooltip();

        this.attribute = "salary";

        this.polygonSets = [
            {
                class: "player-polygons",
                suffix: "polygon",
                fillAccessor: (d) => {
                    return d.site.originalObject.data.originalData.team.color_1;
                }
            },
            {
                class: "player-polygon-images",
                suffix: "polygon-image",
                fillAccessor: (d) => {
                    const player_id = d.site.originalObject.data.originalData.player_id;
                    return `url(#${player_id}-photo)`;
                }
            }
        ];

        this.maxWeight = 100;
        this.weightScale = d3.scaleLinear()
            .domain(d3.extent(playerData, (d) => d[this.attribute]))
            .range([1, this.maxWeight]);
        
        let signedPlayers = playerData.filter(d => d.team.team_id !== "FA" && d.team.team_id !== "RET")
        let teamTotalWeights = Object.values(groupBy(signedPlayers, (d) => d.team.team_id))
                            .map(array => {
                                return array
                                    .map(d => this.weightScale(d[this.attribute]))
                                    .reduce((a, b) => a + b, 0);
                            })
                            
        this.maxTotalWeight = d3.max(teamTotalWeights);
        this.maxCircleRadius = 57;

        this.voronoiRadius = d3.scaleLinear()
            .domain([0, this.maxTotalWeight])
            .range([0, this.maxCircleRadius])

        this.playerData = playerData;
        this.playerData.forEach((player) => {
            player.weight = this.weightScale(player[this.attribute]);
        });
        setPlayerData(this.playerData);

        this.teamData = teamData;
        this.trueTeamData = teamData.filter(d => d.team_id !== 'FA' && d.team_id !== 'RET');

        this.initPlayerPhotos({ playerData })
        
        const geoJSON = topojson.feature(geoData, geoData.objects.states);
        const projection = d3.geoAlbersUsa()
            .fitExtent([[0, 30], [width-60, height-60]], geoJSON);
        this.generateMap({ geoJSON, projection, mapColor });

        this.generateTeamGroups({ projection });

        this.allPolygons = [];
        this.trueTeamData.forEach((team) => {
            let players = this.playerData.filter((player) => player.team !== undefined && player.team.team_id === team.team_id);
            let polygons = this.addTeamTreemap({ team, players })
            this.allPolygons = this.allPolygons.concat(polygons);
        })

        this.generatePolygons(this.allPolygons);
    }

    initTooltip = () => {
        this.tip = d3Tip()
            .attr('class', 'd3-tip')
            .html((d) => {
                const playerData = d.site.originalObject.data.originalData;
                return (
                    `<div class="d3-tip__grid">
                        <div class="d3-tip__player-name">${playerData.player_name}</div>
                        <div class="d3-tip__player-attr">Salary:</div><div class="d3-tip__player-attr">${d3.format("$,.0f")(playerData.salary)}</div>
                        <div class="d3-tip__player-attr">VORP (2020):</div><div class="d3-tip__player-attr">${playerData.vorp}</div>
                        <div class="d3-tip__player-attr">PER (2020):</div><div class="d3-tip__player-attr">${playerData.per}</div>
                    </div>`
                )
            });
            
        this.svg.call(this.tip);
    };

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
                    // (0.45462857 * this.maxTotalWeight)
                    // .attr("width", d => {
                    //     Math.sqrt( this.voronoiRadius(this.weightScale(d[this.attribute])) / this.maxCircleRadius )
                    // })
                    .attr("width", d => Math.sqrt(d[this.attribute] / (159.12 * 57)))
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
            .data(this.trueTeamData, d => d.team_id)
            .enter()
            .append("g")
                .attr("class", d => `team-group ${d.team_id}-group`);

        this.trueTeamData.forEach((team) => {
            const [xCenter, yCenter] = projection([team.longitude, team.latitude])
            team.xCoordinate = xCenter;
            team.yCoordinate = yCenter;

            const players = this.playerData
                .filter((player) => player.team !== undefined && player.team.team_id === team.team_id);
            const weightSum = players.map((x) => this.weightScale(x[this.attribute])).reduce((a, b) => a + b, 0);
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
            .force("collision", d3.forceCollide(d => {
                console.log(d.team_id, d.radius)
                return Math.max(d.radius, 50) + 6
            }))
            .on("tick", tick)
            // .stop()
        
        for (let i =0; i < 500; i++) {
            simulation.tick();
        };
    
    }

    addTeamTreemap = ({ team, players }) => {
        let xVal = team.x || team.xCoordinate;
        let yVal = team.y || team.yCoordinate;

        const weightSum = players.map((x) => this.weightScale(x[this.attribute])).reduce((a, b) => a + b, 0);
        const radius = this.voronoiRadius(weightSum);
        
        const simulation = voronoiMapSimulation(players)
            .prng(seedrandom('randomsed'))
            .clip(getCircleCoordinates(xVal, yVal, radius, 35))
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

    generatePolygons = (polygons, affectedTeams = [], affectedPlayers = []) => {
        const playerTravelTransitionTime = 1800;
        const vis = this;

        polygons = polygons.filter(d => d.site.originalObject.data.originalData.team.team_id !== "FA");

        affectedPlayers.forEach((playerId) => {
            vis.svg.select(`#player-polygon-${playerId}`).raise();
            vis.svg.select(`#player-image-${playerId}`).raise();
        })

        // Create/update both sets of polygons (player image and fill)
        vis.polygonSets.forEach((polygonAttributes) => {
            vis.svg
                .selectAll(`.${polygonAttributes.class}`)
                .data(polygons, d => d.site.originalObject.data.originalData.player_id)
                .join(
                    enter => {
                        enter
                            .append('path')
                            // .raise()
                            .attr("class", d => `${polygonAttributes.class} ${d.site.originalObject.data.originalData.team.team_id}-${polygonAttributes.suffix}`)
                            .attr("id", d => `${polygonAttributes.suffix}-${d.site.originalObject.data.originalData.player_id}`)
                            .on("mouseover", function(e ,d) {
                                vis.tip.show(d, this);

                                const tipElement = d3.select(".d3-tip");
                                const top = this.getBoundingClientRect().top;
                                const offset = tipElement.node().getBoundingClientRect().height;

                                tipElement
                                    .style("position", "fixed")
                                    .style("top", `${top - offset}px`)

                            })
                            .on("mouseout", function(d) {
                                vis.tip.hide(d, this);
                            })
                            .style("fill-opacity", 0.95)
                            .style("fill", d => polygonAttributes.fillAccessor(d))
                            .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)
                            .style("stroke-width", "2px")
                            .attr('d', (d) => {
                                if (affectedPlayers.includes(d.site.originalObject.data.originalData.player_id)) {
                                    const radius = Math.sqrt(d.site.originalObject.data.originalData.salary / (159.12*57)) / 2;
                                    
                                    return generateCirclePath(d[0][0], d[0][1], radius);
                                    // return `M${d.join('L')}z`;
                                }
                                else {
                                    return `M${d.join('L')}z`;
                                }
                            })
                            .transition("initial-positioning")
                            .delay(playerTravelTransitionTime)
                            .duration(0)
                            .attr("d", d => `M${d.join('L')}z`);
                    },

                    update => {     
                        update
                            .style('opacity', d => affectedPlayers.includes(d.site.originalObject.data.originalData.player_id) ? 1.0 : 0.3)
                            .transition("return-opacity")
                            .delay(playerTravelTransitionTime)
                            .style('opacity', 1.0)
                        
                        update.filter(d => affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
                            .raise()
                            .attr('d', (d,i,n) => {
                                const radius = Math.sqrt(d.site.originalObject.data.originalData.salary / (159.12*57)) / 2;
                                
                                let existingPath = d3.select(n[i]).attr('d');
                                const existingCenter = existingPath.slice(1, existingPath.indexOf('L')).split(',');

                                d3.select(n[i])
                                    .attr('startX', existingCenter[0])
                                    .attr('startY', existingCenter[1])

                                const path = generateCirclePath(existingCenter[0], existingCenter[1], radius);
                                return path
                            })
                            .transition("re-position")
                            .duration(playerTravelTransitionTime)
                            .attr('transform', (d,i,n) => {
                                const newCenter = d[0];
                                let startX = d3.select(n[i]).attr('startX');
                                let startY = d3.select(n[i]).attr('startY');

                                const dx = newCenter[0] - startX;
                                const dy = newCenter[1] - startY;  

                                return `translate(${dx},${dy})`
                            })
                            .style("fill", d => polygonAttributes.fillAccessor(d))
                            .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)
                        
                        update.filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                            .transition("remove-translation")
                            .delay(playerTravelTransitionTime)
                            .duration(0)
                            .attr("transform", "translate(0,0)")
                            .transition("re-shuffle")
                            .attr('d', (d) => `M${d.join('L')}z`)

                        return update;
                    },

                    exit => exit
                        .attr('d', (d,i,n) => {
                            const radius = Math.sqrt(d.site.originalObject.data.originalData.salary / (159.12*57)) / 2;
                            const path = generateCirclePath(d[0][0], d[0][1], radius);
                            return path
                        })
                        .transition()
                        .delay(playerTravelTransitionTime/2)
                        .duration(playerTravelTransitionTime/2)
                        .attr('d', (d,i,n) => generateCirclePath(d[0][0], d[0][1], 1))
                        .style("opacity", 0)
                        .remove()
                )

        })     
    }

    updateMapColor = ({ opacity, mapColor }) => { 
        this.mapPath
            .transition()
            .style("fill-opacity", opacity)
            .style("fill", mapColor);
    }

    runTransactions = (playerData, affectedTeams, affectedPlayers) => {
        affectedTeams.forEach((team_id) => {
            this.allPolygons = this.allPolygons.filter((polygon) => polygon.site.originalObject.data.originalData.team.team_id !== team_id) 

            let team = this.teamData.find((t) => t.team_id === team_id)
            let players = playerData.filter((player) => player.team.team_id === team.team_id);
            
            let polygons = this.addTeamTreemap({ team, players })
            this.allPolygons = this.allPolygons.concat(polygons);
        })

        this.generatePolygons(this.allPolygons, affectedTeams, affectedPlayers);
    }
  
    resize = (width, height) => { /*...*/ }
    
  }
  
  export default PlayerMap;