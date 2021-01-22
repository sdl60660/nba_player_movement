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
        const { width, height, mapColor, geoData, teamData, playerData, setPlayerData, sizingAttribute } = props;

        this.svg = d3.select(containerEl)
            .append("svg")
            .attr("viewBox", [0, 0, width, height]);
        
        this.initTooltip();

        this.attribute = sizingAttribute;
        this.playerData = playerData;

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
        this.maxCircleRadius = 57;
        this.setScales();


        // Set player data
        this.playerData = this.setPlayerWeights(this.playerData);
        setPlayerData(this.playerData);


        // Initialize player photo patterns
        this.teamData = teamData;
        this.trueTeamData = teamData.filter(d => d.team_id !== 'FA' && d.team_id !== 'RET');
        this.initPlayerPhotos({ playerData: this.playerData })
        

        // Generate background map and projection
        const geoJSON = topojson.feature(geoData, geoData.objects.states);
        const projection = d3.geoAlbersUsa()
            .fitExtent([[0, 15], [width-60, height-60]], geoJSON);
        this.generateMap({ geoJSON, projection, mapColor });


        // Create team groups
        this.g = this.svg.append("g").attr("id", "polygon-group");
        this.generateTeamGroups({ projection });


        // Create/set team labels
        this.labelGroup = this.svg.append("g").attr("id", "label-group");
        this.setTeamLabels(this.trueTeamData);

        // this.startStatePolygons = [];
        this.allPolygons = [];
    };


    setScales = () => {         
        let playerSet = this.playerData.filter(player => player[this.attribute] !== "-" );      
        let weightScaleDomain = ( this.attribute.includes("per_g") || this.attribute === "salary" ) ?
                                [0, d3.max(playerSet, d => d[this.attribute])] :
                                d3.extent(playerSet.filter(player => player[`${this.attribute.split('_')[0]}_mp`] >= 200), d => d[this.attribute])

        this.weightScale = d3.scaleLinear()
            .domain(weightScaleDomain)
            .range([0.001, this.maxWeight])
            .clamp(true);
        
        let signedPlayers = this.playerData.filter(d => d.team.team_id !== "FA" && d.team.team_id !== "RET")
        let teamTotalWeights = Object.values(groupBy(signedPlayers, (d) => d.team.team_id))
                            .map(array => {
                                return array
                                    .filter(d => d[this.attribute] !== "-")
                                    .map(d => this.weightScale(d[this.attribute]))
                                    .reduce((a, b) => a + b, 0);
                            })
                            
        this.maxTotalWeight = d3.max(teamTotalWeights);

        this.voronoiRadius = d3.scaleLinear()
            .domain([0, this.maxTotalWeight])
            .range([0, this.maxCircleRadius])
    };


    setPlayerWeights(dataset) {
        const vis = this;

        dataset.forEach((player) => {
            player.weight = player[vis.attribute] === "-" ? 0 : vis.weightScale(player[vis.attribute]);
            if (!["salary", "2020_mp_per_g", "2021_mp_per_g"].includes(vis.attribute) && player[`${this.attribute.split('_')[0]}_mp`] < 100) {
                player.weight = 0;
            }
        });

        return dataset;
    };


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
    };


    updateLabelPosition = (teamId, x, y, radius) => {
        const vis = this;

        vis.labelGroup.select(`#${teamId}-label`)
            .attr("x", x)
            .attr("y", 18 + radius + y);
    };


    initTooltip = () => {
        this.tip = d3Tip()
            .attr('class', 'd3-tip')
            .html((d) => {
                const playerData = d.site.originalObject.data.originalData;

                let featuredStat = '';
                if (this.attribute !== "salary") {
                    const selectedOption = d3.select("#attribute-select option:checked");

                    const text = selectedOption.text();
                    const value = selectedOption.node().value;
                    const year = value.split('_')[0];

                    featuredStat = `<div class="d3-tip__player-attr">${text} (${year}):</div><div class="d3-tip__player-attr">${playerData[value] === "-" ? "-" : d3.format(".1f")(playerData[value])}</div>`;
                }
                    
                return (
                    `<div class="d3-tip__grid">
                        <div class="d3-tip__player-name">${playerData.player_name} (${playerData.position})</div>
                        <div class="d3-tip__player-attr">Salary:</div><div class="d3-tip__player-attr">${playerData.salary > 0 ? d3.format("$,.0f")(playerData.salary) : "-"}</div>
                        ${featuredStat}
                    </div>`
                )
            });
        
            // <div class="d3-tip__player-attr">BPM (2020):</div><div class="d3-tip__player-attr">${playerData['2020_bpm'] === "-" ? "-" : d3.format(".1f")(playerData['2020_bpm'])}</div>
            // <div class="d3-tip__player-attr">BPM (2021):</div><div class="d3-tip__player-attr">${playerData['2021_bpm'] === "-" ? "-" : d3.format(".1f")(playerData['2021_bpm'])}</div>
            // <div class="d3-tip__player-attr">BPM (2020):</div><div class="d3-tip__player-attr">${playerData.bpm === "-" ? "-" : d3.format(".1f")(playerData.bpm)}</div>
            // <div class="d3-tip__player-attr">VORP (2020):</div><div class="d3-tip__player-attr">${playerData.vorp === "-" ? "-" : d3.format(".1f")(playerData.vorp)}</div>
            // <div class="d3-tip__player-attr">PER (2020):</div><div class="d3-tip__player-attr">${playerData.per === "-" ? "-" : d3.format(".1f")(playerData.per)}</div>
            
        this.svg.call(this.tip);
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
                    .attr("class", "player-photo-pattern")
                    .attr("width", d => d[this.attribute] === "-" ? 1 : Math.sqrt(this.weightScale(d[this.attribute]) * this.maxCircleRadius * this.maxWeight))
                    .attr("x", 0)
                    .attr("y", 0);
    };
    

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
    };
    

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
                return Math.max(d.radius, 50) + 12
            }))
            .on("tick", tick)
            // .stop()
        
        for (let i =0; i < 500; i++) {
            simulation.tick();
        };
    
    };


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
    };


    generatePolygons = ({ polygons, affectedTeams = [], affectedPlayers = [], direction = "down", attributeTransition = false, midstate = [] }) => {
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
                                const vertOffset = tipElement.node().getBoundingClientRect().height;

                                tipElement
                                    .style("position", "fixed")
                                    .style("top", `${top - vertOffset}px`);
                                
                                if (tipElement.node().getBoundingClientRect().x < 0) {
                                    tipElement
                                        .style("left", 0);
                                }
                                
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
                            .style("stroke-width", d => d.weight <= 0.001 ? "0px" : "2px")
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
                            .attr("lastPosition", (d,i,n) => d3.select(n[i]).attr("d"))
                        },

                    update => {  
                        update
                            .attr("class", d => `player-polygon polygon-${d.site.originalObject.data.originalData.player_id} ${polygonAttributes.class} ${d.site.originalObject.data.originalData.team.team_id}-${polygonAttributes.suffix}`)
                            .style("stroke-width", "2px")
                        
                        if (attributeTransition) {
                            update.filter(d => !affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                                .transition()
                                .attrTween("d", (d,i,n) => {
                                    const previous = d3.select(n[i]).attr("d");
                                    const current = `M${d.join('L')}z`;
                                    return interpolatePath(previous, current);
                                }) 
                            
                            update.filter(d => !affectedPlayers.includes(d.site.originalObject.data.originalData.player_id) && affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                                .transition()
                                .attrTween("d", (d,i,n) => {
                                    const previous = d3.select(n[i]).attr("d");
                                    const current = d3.select(n[i]).attr("midstatePosition")
                                    return interpolatePath(previous, current);
                                }) 
                        }

                        update.filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id))
                            .attr("startPosition", (d,i,n) => d3.select(n[i]).attr("d"))
                            .attr("shapeFinal", (d) => `M${d.join('L')}z`);
                        
                        update.filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id) && !affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
                            .attr("midstatePosition", (d,i,n) => {
                                const matchingPolygon = midstate.find(polygon => polygon.site.originalObject.data.originalData.player_id === d.site.originalObject.data.originalData.player_id)
                                return `M${matchingPolygon.join('L')}z`
                            })

                        update.filter(d => !affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
                            .style("fill", d => polygonAttributes.fillAccessor(d))
                            .style("stroke", d => d.site.originalObject.data.originalData.team.color_2);

                        update.filter(d => affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
                            .raise()
                            .attr("startPath", (d,i,n) => {
                                const element = d3.select(n[i]);
                                const originalData = d.site.originalObject.data.originalData;
                                const radius = Math.sqrt(this.weightScale(originalData[this.attribute]) * this.maxCircleRadius * this.maxWeight) / 2;
                                const existingPath = element.attr('d'); 
                                const existingCenter = existingPath.slice(1, existingPath.indexOf('L')).split(',');

                                element.attr('radius', radius);
                                return getCirclePath(existingCenter, radius);
                            })
                            .attr("positionFinal", (d,i,n) => {
                                const radius = d3.select(n[i]).attr('radius');
                                return getCirclePath(d[0], radius);
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
    };


    updatePositions = ( affectedPlayers, affectedTeams, tweenPosition, direction ) => {
        const vis = this;

        const traverseThreshold = 0.1;
        const reshuffleThreshold = 0.9;

        if (direction === "up") {
            tweenPosition = 1 - tweenPosition;
        }

        // This essentially creates a buffer of 1.0 tween position for the last ~10% of the section, without having to
        // adjust anything else or add other thresholds, so that there's some period of stillness between movement periods
        tweenPosition = Math.min(1.0, tweenPosition*1.1);
        
        // Calcuate position (from 0 to 1) within threshold stage (e.g. what percentage of the way from traverseThreshold are we to the reshuffleThreshold)
        // For use on interpolators, which are set up to span between thresholds
        const stagePosition =   (tweenPosition >= reshuffleThreshold) ?
                                (tweenPosition - reshuffleThreshold) / (1 - reshuffleThreshold) :
                                (tweenPosition <= traverseThreshold) ?
                                tweenPosition / traverseThreshold :
                                (tweenPosition - traverseThreshold) / (reshuffleThreshold - traverseThreshold);


        let selection = vis.svg.selectAll(".player-polygon:not(.enter-polygon):not(.exit-polygon)");

        selection
            .filter(d => affectedTeams.includes(d.site.originalObject.data.originalData.team.team_id) && !affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
            // .transition()
            .attr("d", (d,i,n) => {
                const element = d3.select(n[i]);
                const originalShape = element.attr("startPosition");
                const midstatePosition = element.attr("midstatePosition");
                const shapeFinal = element.attr("shapeFinal");

                if (tweenPosition >= reshuffleThreshold) {
                    return interpolatePath(midstatePosition, shapeFinal)(stagePosition);
                }
                else if (tweenPosition <= traverseThreshold) {
                    return interpolatePath(originalShape, midstatePosition)(stagePosition);
                }
                else {
                    return midstatePosition;
                }
            })


        selection
            .filter(d => affectedPlayers.includes(d.site.originalObject.data.originalData.player_id))
            // .transition()
            .attr('d', (d,i,n) => {
                const element = d3.select(n[i]);

                const startPosition = element.attr("startPosition");
                const circleStart = element.attr("startPath");

                const positionFinal = element.attr("positionFinal");
                const shapeFinal = element.attr("shapeFinal");

                if (tweenPosition < traverseThreshold) {
                    // const photoPatternOffset = 8.0*stagePosition - 8.0;
                    // d3.select(`#${d.player_id}-photo-pattern`)
                    //     .attr("x", d => Math.sqrt(vis.weightScale(d[vis.attribute]) * vis.maxCircleRadius * vis.maxWeight) / photoPatternOffset);

                    return interpolatePath(startPosition, circleStart)(stagePosition);
                }
                else if (traverseThreshold <= tweenPosition && tweenPosition < reshuffleThreshold) {
                    // const photoPatternOffset = -8.0*stagePosition;
                    // d3.select(`#${d.player_id}-photo-pattern`)
                    //     .attr("x", d => Math.sqrt(vis.weightScale(d[vis.attribute]) * vis.maxCircleRadius * vis.maxWeight) / photoPatternOffset);
                        
                    return interpolatePath(circleStart, positionFinal)(stagePosition);
                }
                else {
                    // d3.select(`#${d.player_id}-photo-pattern`)
                    //     .attr("x", 0);
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


        vis.svg.selectAll('.enter-polygon')
            .attr('d', (d,i,n) => {
                const element = d3.select(n[i]);

                const startPosition = getCirclePath(d[0], 0.5);
                const circlePath = element.attr("circlePath");
                const finalPosition = `M${d.join('L')}z`;

                if (tweenPosition <= traverseThreshold) {
                    return interpolatePath(startPosition, circlePath)(stagePosition);
                }
                else if (tweenPosition >= reshuffleThreshold) {
                    return interpolatePath(circlePath, finalPosition)(stagePosition);
                }
                else {
                    return circlePath;
                }
            })
            .style("stroke-width", () => {
                if (tweenPosition <= traverseThreshold) {
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
                    return interpolatePath(startPosition, middlePosition)(stagePosition);
                }
                else if (tweenPosition >= reshuffleThreshold) {
                    return interpolatePath(middlePosition, endPosition)(stagePosition);
                }
                else {
                    return middlePosition;
                }
            })
            .style("stroke-width", () => {
                if (tweenPosition >= reshuffleThreshold) {
                    return d3.interpolateNumber(2, 0)(stagePosition);
                }
                else {
                    return 2;
                }
            })

    };


    changeWeightAttribute = ({ startState, endState, sizingAttribute, affectedTeams, affectedPlayers, stepProgress, scrollDirection }) => {
        const vis = this;

        // Set new sizing attribute for player polygon weights
        vis.attribute = sizingAttribute;

        // Switch weightScale domain to new attribute
        vis.setScales();

        [startState, endState].forEach((dataset) => {
            if (dataset.length === 0) {
                return;
            }

            dataset = this.setPlayerWeights(dataset);

            let allMidstatePolygons = [];
            vis.allPolygons = [];
            vis.trueTeamData.forEach((team) => {
                let players = dataset.filter((player) => player.weight !== 0 && player.team !== undefined && player.team.team_id === team.team_id);
                let polygons = vis.addTeamTreemap({ team, players })
                vis.allPolygons = vis.allPolygons.concat(polygons);

                let unaffectedPlayers = players.filter(player => !affectedPlayers.includes(player.player_id))
            
                let midstatePolygons = this.addTeamTreemap({ team, players: unaffectedPlayers })
                allMidstatePolygons = allMidstatePolygons.concat(midstatePolygons)
            })

            // Draw those polygons
            vis.generatePolygons({ polygons: vis.allPolygons, affectedTeams, affectedPlayers, direction: scrollDirection, attributeTransition: true, midstate: allMidstatePolygons } );
        })
        
        if (affectedTeams.length !== 0) {
            vis.updatePositions(affectedPlayers, affectedTeams, stepProgress, scrollDirection)
        }

        // Resize photos
        vis.svg.selectAll(".player-photo-pattern")
            .attr("width", d => d[sizingAttribute] === "-" ? 1 : Math.sqrt(vis.weightScale(d[sizingAttribute]) * vis.maxCircleRadius * vis.maxWeight))
            .attr("x", d => {
                if (sizingAttribute === "salary") {
                    return 0;
                }
                else {
                    return Math.sqrt(vis.weightScale(d[sizingAttribute]) * vis.maxCircleRadius * vis.maxWeight) / -8;
                }
            })

        vis.svg.selectAll(".exit-polygon").remove();

        return [startState, endState]
    };


    runTransactions = (playerData, affectedTeams, affectedPlayers, scrollDirection, sizingAttribute) => {

        let allMidstatePolygons = [];
        affectedTeams.forEach((team_id) => {
            this.allPolygons = this.allPolygons.filter((polygon) => polygon.site.originalObject.data.originalData.team.team_id !== team_id) 

            let team = this.teamData.find((t) => t.team_id === team_id)
            let players = playerData.filter(player => player.team.team_id === team.team_id && player.weight !== 0)            
            
            let unaffectedPlayers = players.filter(player => !affectedPlayers.includes(player.player_id))
            
            let midstatePolygons = this.addTeamTreemap({ team, players: unaffectedPlayers })
            let polygons = this.addTeamTreemap({ team, players })
            
            this.allPolygons = this.allPolygons.concat(polygons);
            allMidstatePolygons = allMidstatePolygons.concat(midstatePolygons)
        })
        
        this.generatePolygons({ polygons: this.allPolygons, affectedTeams, affectedPlayers, direction: scrollDirection , midstate: allMidstatePolygons } );
        return
    };


    updateMapColor = ({ opacity, mapColor }) => { 
        this.mapPath
            .transition()
            .style("fill-opacity", opacity)
            .style("fill", mapColor);
    };
    
  }
  
  export default PlayerMap;