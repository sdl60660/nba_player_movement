// @flow

import React, { useState, useEffect, useReducer, useRef } from 'react';
import scrollama from 'scrollama';
import * as d3 from 'd3';
import * as chromatic from "d3-scale-chromatic";
import { isEqual } from 'lodash';

import PlayerMapControls from './PlayerMapControls';
import PlayerMap from '../d3-components/PlayerMap';
import PlayerMapContext from '../context/playerMapContext';
import TransactionCard from './TransactionCard';

import transactionReducer from '../reducers/transactionReducer';


let vis;
let allAffectedTeams = [];
let allAffectedPlayers = [];
let scrollDirection = "down";
let phantomFlag = false;
let originalState;


const PlayerMapWrapper = ({ _geoData, _teamData, _playerData, transactionData }) => {

    const [mapColor, setMapColor] = useState(chromatic.schemeCategory10[0]);
    const [geoData, setGeoData] = useState(_geoData);
    const [teamData, setTeamData] = useState(_teamData);
    const [playerData, setPlayerData] = useState(_playerData);
    const [sizingAttribute, setSizingAttribute] = useState("salary");

    const [width, setWidth] = useState(1300);
    const [height, setHeight] = useState(750);
    const [opacity, setOpacity] = useState(0.3);

    originalState = JSON.parse(JSON.stringify(_playerData.slice()));

    const transactionDates = Object.keys(transactionData);
    const playerDataIds = playerData.map((player) => player.player_id);

    let stepProgress = 0;

    const processPlayerMovement = ({ player, direction, transaction, allAffectedPlayers, state }) => {
        allAffectedPlayers.push(player.player_id);

        const playerIndex = playerDataIds.indexOf(player.player_id);

        state[playerIndex].team = teamData
            // Reverse transaction if running upwards
            .find((team) => team.team_id === ( direction === "down" ? player.to_team : player.from_team));
        
        if (transaction.type === "signed") {
            const startSalary = transaction.salary_data ? transaction.salary_data.start_salary : state[playerIndex].start_salary
            const endSalary = transaction.salary_data ? transaction.salary_data.end_salary : state[playerIndex].end_salary;

            state[playerIndex].salary = (direction === "down") ? endSalary : startSalary;
            
            if (sizingAttribute === "salary") {
                state[playerIndex].weight = vis.weightScale(state[playerIndex][sizingAttribute]);
                vis.svg.select(`#${state[playerIndex].player_id}-photo-pattern`)
                    .attr("width", d => d[sizingAttribute] === "-" ? 1 : Math.sqrt(vis.weightScale(d[sizingAttribute]) * vis.maxCircleRadius * vis.maxWeight))
            }
        }

        return [allAffectedPlayers, state];
    }

    const processStepTransactions = ({ element, index, direction }) => {
        let transactionDate = transactionDates[index];
        let transactions = transactionData[transactionDate];

        allAffectedTeams = [];
        allAffectedPlayers = [];
        
        setPlayerData((state) => {
            // Maintain correct ordering on transactions if running upwards, for things like sign-and-trades
            transactions = direction === "down" ? transactions : transactions.slice().reverse();

            transactions.filter(d => d.type !== "contract extension" && d.type !== "exercised option").forEach((transaction) => {
                allAffectedTeams = allAffectedTeams.concat(transaction.affected_teams);
                const playerArray = transaction.players;

                transaction.players.forEach((player) => {
                    [allAffectedPlayers, state] = processPlayerMovement({ player, direction, transaction, allAffectedPlayers, state })
                })
            })
            return state;
        })

        allAffectedTeams = [...new Set(allAffectedTeams.filter((team) => team !== "FA" && team !== "RET"))];
        allAffectedPlayers = [...new Set(allAffectedPlayers)];

        // vis.runTransactions(playerData, allAffectedTeams, allAffectedPlayers, scrollDirection);
        // vis.setTeamLabels(vis.trueTeamData);
    }


    const processProgress = ({ element, index, progress, scrollDirection }) => {
        stepProgress = progress;
        vis.updatePositions(allAffectedPlayers, allAffectedTeams, progress, scrollDirection)
    }

    const setTransactionHoverEvent = () => {
        d3.selectAll(".transaction-card__transaction-item")
            .on("mouseover", function() {
                const element = d3.select(this);

                d3.selectAll(".transaction-card__transaction-item")
                    .style("opacity", 0.3)
                
                element
                    .style("opacity", 1.0)

                d3.selectAll(`.player-polygon`)
                    .style("opacity", 0.3);
                
                const classSelector = element.attr("class").replaceAll("transaction-log-", ", .polygon-")
                d3.selectAll(classSelector)
                    .style("opacity", 1.0);
            })
            .on("mouseout", function(e) {
                d3.selectAll(".transaction-card__transaction-item")
                    .style("opacity", 1.0)

                d3.selectAll(`.player-polygon`)
                    .style("opacity", 1.0);
            })
    }

    const refElement = useRef(null);
    let scroller = scrollama();

    useEffect(() => {
        vis = new PlayerMap(refElement.current, {
            width,
            height,
            mapColor,
            geoData,
            teamData,
            playerData,
            setPlayerData,
            sizingAttribute
        });
        
        scroller
            .setup({
                step: ".transaction-card",
                debug: false,
                progress: true,
                threshold: 2,
                order: true
            })
            .onStepEnter(({ element, index, direction }) => {
                // console.log('enter', index, direction)
                scrollDirection = direction;
                if (element.getAttribute("class").includes("phantom")) {
                    phantomFlag = true;
                    return;
                }
                else {
                    if (direction === "up" && phantomFlag === false) {
                        processStepTransactions({ element, index: (index + 1), direction });
                        vis.runTransactions(playerData, allAffectedTeams, allAffectedPlayers, scrollDirection, sizingAttribute);
                    }
                    processStepTransactions({ element, index, direction })
                    vis.runTransactions(playerData, allAffectedTeams, allAffectedPlayers, scrollDirection, sizingAttribute);

                    phantomFlag = false;
                }
            })
            .onStepExit(({ element, index, direction }) => {
                // If at the top, check that roster state is same as at the start 
                // if (index === 0 && direction === "up") {
                //     playerData.forEach(player => {
                //         const match = originalState.find(x => x.player_id === player.player_id)
                //         console.log(match.team.team_id === player.team.team_id)
                //         if (match.team.team_id !== player.team.team_id) {
                //             console.log("Non-match", match.player_id, match.team.team_id, player.team.team_id);
                //         }
                //     })
                // }
                if (scrollDirection === direction) {
                    d3.selectAll(".exit-polygon").remove();
                }
                else {
                    d3.selectAll(".enter-polygon").remove();
                }

                return;
            })
            .onStepProgress(({ element, index, progress }) => {
                if (element.getAttribute("class").includes("phantom")) {
                    return;
                }
                else {
                    processProgress({ element, index, progress, scrollDirection })
                }
            });

        window.addEventListener("resize", scroller.resize);

        setTransactionHoverEvent();
    }, []);

    useEffect(() => {
        vis.updateMapColor({ mapColor, opacity })
    }, [mapColor, opacity]);

    useEffect(() => {
        console.log("triggered", scrollDirection, sizingAttribute, stepProgress, allAffectedTeams, allAffectedPlayers);
        if (stepProgress === 0) {
            allAffectedTeams = [];
            allAffectedPlayers = [];
        }
        if (sizingAttribute) {
            vis.changeWeightAttribute({ sizingAttribute,
                                        setPlayerData,
                                        affectedTeams: allAffectedTeams,
                                        affectedPlayers: allAffectedPlayers,
                                        stepProgress,
                                        scrollDirection
                                    })
        }
    }, [sizingAttribute]);


    return (
        <section id={"scroll"}>
          <div id={"viz-column"}>
            <PlayerMapContext.Provider value={{ opacity, setOpacity, mapColor, setMapColor, setHeight, setWidth, sizingAttribute, setSizingAttribute }}>
                <div ref={refElement} id={"viz-tile"}>
                    {/* <PlayerMapControls /> */}
                </div>
            </PlayerMapContext.Provider>
          </div>
          <div className={"text-column"} id={"annotations"}>
                { Object.entries(transactionData).map(
                    (transactionDateData, i) =>
                        <TransactionCard 
                            className={"transaction-card"}
                            key={i}
                            transactionDate={transactionDateData[0]}
                            transactions={transactionDateData[1]}
                        />
                    )
                }
                <div key={"phantom-end"} className={"transaction-card phantom"} />
          </div>
      </section>
    )
}

export { PlayerMapWrapper as default }
