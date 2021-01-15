// @flow

import * as d3 from 'd3';
import d3Tip from "d3-tip"
import { interpolatePath } from 'd3-interpolate-path';
import * as topojson from "topojson-client";
import seedrandom from 'seedrandom';
import { groupBy } from 'lodash';
import { voronoiMapSimulation } from 'd3-voronoi-map';


const getCirclePath = (center, radius) => {
    const circleCoordinates = getCircleCoordinates(parseFloat(center[0]), parseFloat(center[1]), radius, 20);
    return `M${circleCoordinates.join('L')}L${circleCoordinates[0]}z`;
}

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
    
    return coordinates.reverse();
}

class PlayerMap {

    containerEl;
    props;
  
    constructor(containerEl, props) {
        this.containerEl = containerEl;
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

        // Set scales
        this.maxWeight = 10;
        this.weightScale = d3.scaleLinear()
            .domain(d3.extent(playerData.filter(player => player[this.attribute] !== "-"), d => d[this.attribute]))
            .range([0, this.maxWeight]);
        
        let signedPlayers = playerData.filter(d => d.team.team_id !== "FA" && d.team.team_id !== "RET")
        let teamTotalWeights = Object.values(groupBy(signedPlayers, (d) => d.team.team_id))
                            .map(array => {
                                return array
                                    .filter(d => d[this.attribute] !== "-")
                                    .map(d => this.weightScale(d[this.attribute]))
                                    .reduce((a, b) => a + b, 0);
                            })
                            
        this.maxTotalWeight = d3.max(teamTotalWeights);
        this.maxCircleRadius = 58;

        this.voronoiRadius = d3.scaleLinear()
            .domain([0, this.maxTotalWeight])
            .range([0, this.maxCircleRadius])


        // Set player data
        // This part would need to run again on change to attribute
        this.playerData = playerData;
        this.playerData.forEach((player) => {
            player.weight = player[this.attribute] === "-" ? 0 : this.weightScale(player[this.attribute]);
        });
        setPlayerData(this.playerData);


        // Initialize player photo patterns
        this.teamData = teamData;
        this.trueTeamData = teamData.filter(d => d.team_id !== 'FA' && d.team_id !== 'RET');
        this.initPlayerPhotos({ playerData })
        

        // Generate background map and projection
        const geoJSON = topojson.feature(geoData, geoData.objects.states);
        const projection = d3.geoAlbersUsa()
            .fitExtent([[0, 30], [width-60, height-60]], geoJSON);
        this.generateMap({ geoJSON, projection, mapColor });


        // Create team groups
        this.g = this.svg.append("g").attr("id", "polygon-group");
        this.labelGroup = this.svg.append("g").attr("id", "label-group");
        this.generateTeamGroups({ projection });


        // Create/set team labels
        this.setTeamLabels(this.trueTeamData);


        // Calculate voronoi treemaps for each team's players
        this.allPolygons = [];
        this.trueTeamData.forEach((team) => {
            let players = this.playerData.filter((player) => player.team !== undefined && player.team.team_id === team.team_id);
            let polygons = this.addTeamTreemap({ team, players })
            this.allPolygons = this.allPolygons.concat(polygons);
        })


        // Draw those polygons
        this.generatePolygons(this.allPolygons);
    }

    setTeamLabels = (teamData) => {
        const vis = this;

        vis.labelGroup.selectAll(".team-label")
            .data(teamData, d => d.team_id)
            .join(
                enter => enter
                    .append("text")
                    .attr("class", "team-label")
                    .attr("id", d => `${d.team_id}-label`)
                    .text(d => d.team_full_name)
                    .style("font-size", "0.85rem")
                    .style("fill", d => d.color_1)
                    .style("stroke", d => "white")
                    .style("stroke-width", "3px")
                    .style("paint-order", "stroke")
                    .style("font-weight", "bold")
                    .attr("x", d => {
                        return (d.x || d.xCoordinate);
                    })
                    .attr("y", d => {
                        return 18 + d.radius + (d.y || d.yCoordinate);
                    })
                    .style("text-anchor", "middle")
                    .style("padding", "0.5rem")
                    .style("background-color", "white")
                    .style("display", "none")
            )
    }

    updateLabelPosition = (teamId, x, y, radius) => {
        const vis = this;

        vis.labelGroup.select(`#${teamId}-label`)
            .attr("x", x)
            .attr("y", 18 + radius + y);
    }

    initTooltip = () => {
        this.tip = d3Tip()
            .attr('class', 'd3-tip')
            .html((d) => {
                const playerData = d.site.originalObject.data.originalData;
                return (
                    `<div class="d3-tip__grid">
                        <div class="d3-tip__player-name">${playerData.player_name} (${playerData.position})</div>
                        <div class="d3-tip__player-attr">Salary:</div><div class="d3-tip__player-attr">${playerData.salary > 1 ? d3.format("$,.0f")(playerData.salary) : "-"}</div>
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
                    .attr("xlink:href", d => `images/player_photos/${d.player_id}.png`)
                    .attr("id", d => `${d.player_id}-photo-pattern`)
                    .attr("width", d => d[this.attribute] === "-" ? 1 : Math.sqrt(this.weightScale(d[this.attribute]) * this.maxCircleRadius * this.maxWeight))
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
                    .style("stroke", "black")
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
                .filter((player) => player[this.attribute] !== "-" && player.team !== undefined && player.team.team_id === team.team_id);
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
                // console.log(d.team_id, d.radius)
                return Math.max(d.radius, 50) + 8
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

        const weightSum = players
                                .filter(x => x[this.attribute] !== "-")
                                .map((x) => this.weightScale(x[this.attribute])).reduce((a, b) => a + b, 0);

        const radius = this.voronoiRadius(weightSum);
        
        const simulation = voronoiMapSimulation(players)
            .prng(seedrandom('randomsed'))
            .clip(getCircleCoordinates(xVal, yVal, radius, 35))
            .initialPosition((d) => {
                const polygon = this.svg.select(`#polygon-${d.player_id}`)

                return (polygon.nodes().length > 0 &&
                        polygon.data()[0].site.originalObject.data.originalData.team.team_id === d.team.team_id) ?
                    [polygon.data()[0].site.x, polygon.data()[0].site.y] :
                    [undefined, undefined]
            })
            .stop()                                               

        let state = simulation.state();
        while (!state.ended) {
            simulation.tick();
            state = simulation.state();
        }

        this.updateLabelPosition(team.team_id, xVal, yVal, radius);
        
        return state.polygons;
    }

    generatePolygons = (polygons, affectedTeams = [], affectedPlayers = []) => {
        const vis = this;

        polygons = polygons.filter(d => d.site.originalObject.data.originalData.team.team_id !== "FA");

        affectedPlayers.forEach((playerId) => {
            vis.svg.select(`#polygon-${playerId}`).raise();
            vis.svg.select(`#polygon-image-${playerId}`).raise();
        })

        // Create/update both sets of polygons (player image and fill)
        vis.polygonSets.forEach((polygonAttributes) => {
            vis.g
                .selectAll(`.${polygonAttributes.class}`)
                .data(polygons, d => d.site.originalObject.data.originalData.player_id)
                .join(
                    enter => {
                        enter
                            .append('path')
                            .raise()
                            .attr("class", d => `player-polygon polygon-${d.site.originalObject.data.originalData.player_id} ${polygonAttributes.class} ${d.site.originalObject.data.originalData.team.team_id}-${polygonAttributes.suffix} enter-polygon`)
                            .attr("id", d => `${polygonAttributes.suffix}-${d.site.originalObject.data.originalData.player_id}`)
                            .on("mouseover", function(e ,d) {
                                vis.tip.show(d, this);

                                const tipElement = d3.select(".d3-tip");
                                const top = this.getBoundingClientRect().top;
                                const offset = tipElement.node().getBoundingClientRect().height;

                                tipElement
                                    .style("position", "fixed")
                                    .style("top", `${top - offset}px`);
                                
                                const originalData = d.site.originalObject.data.originalData;

                                d3.selectAll(".transaction-card__transaction-item")
                                    .style("opacity", 0.3)

                                d3.selectAll(`.transaction-log-${originalData.player_id}`)
                                    .style("opacity", 1.0)

                                vis.labelGroup.selectAll(`#${originalData.team.team_id}-label`)
                                    .style("display", "inline-block")
                            })
                            .on("mouseout", function(d) {
                                vis.tip.hide(d, this);

                                d3.selectAll(".transaction-card__transaction-item")
                                    .style("opacity", 1.0)
                                
                                vis.labelGroup.selectAll(".team-label")
                                    .style("display", "none")
                            })
                            .style("fill-opacity", 0.95)
                            .style("fill", d => polygonAttributes.fillAccessor(d))
                            .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)
                            .style("stroke-width", "2px")
                            .attr('d', (d,i,n) => {
                                if (affectedPlayers.includes(d.site.originalObject.data.originalData.player_id)) {
                                    const originalData = d.site.originalObject.data.originalData;
                                    const radius = Math.sqrt(this.weightScale(originalData[this.attribute]) * this.maxCircleRadius * this.maxWeight) / 2;
                                    const path = getCirclePath(d[0], radius);
                                    d3.select(n[i]).attr("circlePath", path)
                                    return getCirclePath(d[0], 1);
                                }
                                else {
                                    return `M${d.join('L')}z`;
                                }
                            })
                    },

                    update => {  
                        update
                            .attr("class", d => `player-polygon polygon-${d.site.originalObject.data.originalData.player_id} ${polygonAttributes.class} ${d.site.originalObject.data.originalData.team.team_id}-${polygonAttributes.suffix}`)
                            .style("stroke-width", "2px")
                        
                        update.filter(d => !affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                            .attr("d", d => `M${d.join('L')}z`)

                        update.filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                            .attr("startPosition", (d,i,n) => d3.select(n[i]).attr("d"))

                        update.filter(d => !affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
                            .style("fill", d => polygonAttributes.fillAccessor(d))
                            .style("stroke", d => d.site.originalObject.data.originalData.team.color_2)
                        
                        update.filter(d => affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
                            .raise()
                            .attr('startPath', (d,i,n) => {
                                const originalData = d.site.originalObject.data.originalData;
                                const radius = Math.sqrt(this.weightScale(originalData[this.attribute]) * this.maxCircleRadius * this.maxWeight) / 2;
                                
                                let existingPath = d3.select(n[i]).attr('d');
                                const existingCenter = existingPath.slice(1, existingPath.indexOf('L')).split(',');

                                d3.select(n[i])
                                    .attr('radius', radius);

                                return getCirclePath(existingCenter, radius);
                            })
                            .attr("originalFill", (d,i,n) => d3.select(n[i]).style("fill"))
                            .attr("originalStroke", (d,i,n) => d3.select(n[i]).style("stroke"))

                        return update;
                    },

                    exit => exit
                        .attr("class", d => `exit-polygon player-polygon polygon-${d.site.originalObject.data.originalData.player_id} ${polygonAttributes.class} ${d.site.originalObject.data.originalData.team.team_id}-${polygonAttributes.suffix}`)
                        .attr("startPosition", (d,i,n) => d3.select(n[i]).attr("d"))
                )
        })
    }

    updatePositions = ( affectedPlayers, affectedTeams, tweenPosition, direction ) => {
        const vis = this;

        const traverseThreshold = 0.1;
        const reshuffleThreshold = 0.9;

        if (direction === "up") {
            tweenPosition = 1 - tweenPosition;
        }

        let selection = vis.svg.selectAll(".player-polygon:not(.enter-polygon):not(.exit-polygon)");
        selection
            .filter(d => affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
            .attr('d', (d,i,n) => {
                const element = d3.select(n[i]);
                const radius = element.attr("radius");

                const originalShape = element.attr("startPosition");
                const circleStart = element.attr("startPath");

                const positionFinal = getCirclePath(d[0], radius);
                const shapeFinal = `M${d.join('L')}z`;

                if (tweenPosition < traverseThreshold) {
                    const stagePosition = tweenPosition / traverseThreshold;
                    return interpolatePath(originalShape, circleStart)(stagePosition);
                }
                else if (traverseThreshold <= tweenPosition && tweenPosition < reshuffleThreshold) {
                    const stagePosition = (tweenPosition - traverseThreshold) / (reshuffleThreshold - traverseThreshold);
                    return interpolatePath(circleStart, positionFinal)(stagePosition);
                }
                else {
                    const stagePosition = (tweenPosition - reshuffleThreshold) / (1 - reshuffleThreshold);
                    return interpolatePath(positionFinal, shapeFinal)(stagePosition);
                }
            })
            .style("stroke", (d,i,n) => {
                const element = d3.select(n[i]);
                const originalColor = element.attr("originalStroke")
                const updatedColor = d.site.originalObject.data.originalData.team.color_2;

                return d3.interpolateRgb(originalColor, updatedColor)(tweenPosition);
            })
            .style("fill", (d,i,n)  => {
                const element = d3.select(n[i]);
                const originalColor = element.attr("originalFill")
                if (originalColor.startsWith("rgb")) {
                    const updatedColor = d.site.originalObject.data.originalData.team.color_1;
                    return d3.interpolateRgb(originalColor, updatedColor)(tweenPosition);
                }
                else {
                    return originalColor;
                }
            })

        selection.filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id) && !affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
            .attr("d", (d,i,n) => {
                const element = d3.select(n[i]);
                const originalShape = element.attr("startPosition");
                const shapeFinal = `M${d.join('L')}z`;

                if (tweenPosition >= reshuffleThreshold) {
                    const stagePosition = (tweenPosition - reshuffleThreshold) / (1 - reshuffleThreshold);
                    return interpolatePath(originalShape, shapeFinal)(stagePosition);
                }
                else {
                    return originalShape;
                }
            })


        vis.svg.selectAll('.enter-polygon')
            .attr('d', (d,i,n) => {
                const element = d3.select(n[i]);

                const startPosition = getCirclePath(d[0], 0.5);
                const circlePath = element.attr("circlePath");
                const finalPosition = `M${d.join('L')}z`;

                if (tweenPosition <= traverseThreshold) {
                    const stagePosition = tweenPosition / traverseThreshold;
                    return interpolatePath(startPosition, circlePath)(stagePosition);
                }
                else if (tweenPosition >= reshuffleThreshold) {
                    const stagePosition = (tweenPosition - reshuffleThreshold) / (1 - reshuffleThreshold);
                    return interpolatePath(circlePath, finalPosition)(stagePosition);
                }
                else {
                    return circlePath;
                }
            })
            .style("stroke-width", () => {
                if (tweenPosition <= traverseThreshold) {
                    const stagePosition = tweenPosition / traverseThreshold;
                    return d3.interpolateNumber(0, 2)(stagePosition);
                }
                else {
                    return 2;
                }
            })
        
        vis.svg.selectAll(".exit-polygon")
            .attr('d', (d,i,n) => {
                const element = d3.select(n[i]);

                const originalData = d.site.originalObject.data.originalData;
                const radius = Math.sqrt(this.weightScale(originalData[this.attribute]) * this.maxCircleRadius * this.maxWeight) / 2;
                
                const startPosition = element.attr("startPosition");
                const middlePosition = getCirclePath(d[0], radius);
                const endPosition = getCirclePath(d[0], 0.5);

                if (tweenPosition <= traverseThreshold) {
                    const stagePosition = tweenPosition / traverseThreshold;
                    return interpolatePath(startPosition, middlePosition)(stagePosition);
                }
                else if (tweenPosition >= reshuffleThreshold) {
                    const stagePosition = (tweenPosition - reshuffleThreshold) / (1 - reshuffleThreshold);
                    return interpolatePath(middlePosition, endPosition)(stagePosition);
                }
                else {
                    return middlePosition;
                }
            })
            .style("stroke-width", () => {
                if (tweenPosition >= reshuffleThreshold) {
                    const stagePosition = (tweenPosition - reshuffleThreshold) / (1 - reshuffleThreshold);
                    return d3.interpolateNumber(2, 0)(stagePosition);
                }
                else {
                    return 2;
                }
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
            let players = playerData.filter((player) => player[this.attribute] !== "-" && player.team.team_id === team.team_id);
            
            let polygons = this.addTeamTreemap({ team, players })
            this.allPolygons = this.allPolygons.concat(polygons);
        })

        return this.generatePolygons(this.allPolygons, affectedTeams, affectedPlayers);
    }
    
  }
  
  export default PlayerMap;