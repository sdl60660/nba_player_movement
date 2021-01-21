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
let stepProgress = 0;
let phantomFlag = false;
let originalState;

let startState = [];
let endState = [];


const PlayerMapWrapper = ({ _geoData, _teamData, _playerData, transactionData }) => {

    const [mapColor, setMapColor] = useState(chromatic.schemeCategory10[0]);
    // const [geoData, setGeoData] = useState(_geoData);
    // const [teamData, setTeamData] = useState(_teamData);
    
    // const [playerStartData, setPlayerStartData] = useState([])
    const [playerData, setPlayerData] = useState(_playerData);
    const [sizingAttribute, setSizingAttribute] = useState("salary");

    const [width, setWidth] = useState(1300);
    const [height, setHeight] = useState(700);
    const [opacity, setOpacity] = useState(0.3);

    const geoData = _geoData;
    const teamData = _teamData;
    originalState = JSON.parse(JSON.stringify(_playerData.slice()));
    endState = playerData;

    const transactionDates = Object.keys(transactionData);
    const playerDataIds = originalState.map((player) => player.player_id);

    let isMobile = window.matchMedia ? window.matchMedia('(max-width: 1100px)').matches : false;

    const processPlayerMovement = ({ player, direction, transaction, allAffectedPlayers, state }) => {
        allAffectedPlayers.push(player.player_id);

        const playerIndex = playerDataIds.indexOf(player.player_id);

        state[playerIndex].team = teamData
            // Reverse transaction if running upwards
            .find((team) => team.team_id === ( direction === "down" ? player.to_team : player.from_team));
        
        if (transaction.type === "signed") {
            const startSalary = transaction.salary_data ? transaction.salary_data.start_salary : state[playerIndex].start_salary
            const endSalary = transaction.salary_data ? transaction.salary_data.end_salary : state[playerIndex].end_salary;

            // console.log(vis.attribute)
            state[playerIndex].salary = (direction === "down") ? endSalary : startSalary;
            
            if (vis.attribute === "salary") {
                state[playerIndex].weight = vis.weightScale(state[playerIndex][vis.attribute]);
                vis.svg.select(`#${state[playerIndex].player_id}-photo-pattern`)
                    .attr("width", d => d[vis.attribute] === "-" ? 1 : Math.sqrt(vis.weightScale(d[vis.attribute]) * vis.maxCircleRadius * vis.maxWeight))
            }
        }

        return [allAffectedPlayers, state];
    }

    const processStepTransactions = ({ index, direction, stateUpdateFunction }) => {
        let transactionDate = transactionDates[index];
        let transactions = transactionData[transactionDate];

        allAffectedTeams = [];
        allAffectedPlayers = [];
        
        stateUpdateFunction((state) => {
            // console.log(state);
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

    const stepEnterHandler = ( { element, index, direction }) => {                
        if (element.getAttribute("class").includes("phantom")) {
            phantomFlag = true;
            return;
        }

        else if (direction === "up") {
            if (phantomFlag === false) {
                processStepTransactions({ element, index: (index + 1), direction, stateUpdateFunction: setPlayerData });
                endState = playerData;
                vis.runTransactions(endState, allAffectedTeams, allAffectedPlayers, direction, sizingAttribute);
            }

            processStepTransactions({ element, index, direction, stateUpdateFunction: setPlayerData })
            startState = playerData;
            vis.runTransactions(endState, allAffectedTeams, allAffectedPlayers, direction, sizingAttribute);

            phantomFlag = false;
        }

        else {
            if (scrollDirection !== direction && index !== 0) {
                processStepTransactions({ element, index: (index - 1), direction, stateUpdateFunction: setPlayerData })
                vis.runTransactions(endState, allAffectedTeams, allAffectedPlayers, scrollDirection, sizingAttribute);
            }

            startState = endState;
            processStepTransactions({ element, index, direction, stateUpdateFunction: setPlayerData })
            endState = playerData;
            vis.runTransactions(endState, allAffectedTeams, allAffectedPlayers, direction, sizingAttribute);

            phantomFlag = false;
        }

        scrollDirection = direction;
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
                threshold: 1,
                order: true
            })
            .onStepEnter(({ element, index, direction }) => stepEnterHandler({ element, index, direction }))
            .onStepExit(({ element, index, direction }) => {
                if (scrollDirection === direction) {
                    return d3.selectAll(".exit-polygon").remove();
                }
                else {
                    return d3.selectAll(".enter-polygon").remove();
                }
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
            [startState, endState] = vis.changeWeightAttribute({
                    startState,
                    endState,
                    sizingAttribute,
                    affectedTeams: allAffectedTeams,
                    affectedPlayers: allAffectedPlayers,
                    stepProgress,
                    scrollDirection
                })
            
            // startState = newStartState;
            setPlayerData(endState);
            // endState = playerData;
        }
    }, [sizingAttribute]);

    
    const teamOptionData = teamData.filter(({ team_id }) => team_id !== "FA" && team_id !== "RET").map(({team_full_name, team_id}) => {
        return { label: team_full_name, value: team_id };
    })
    const transactionTypeData = ['Traded', 'Signed', 'Waived', 'Claimed', 'Contract Extension', 'Exercised Option', 'Declined Option'].map(transactionType => { 
        return { label: transactionType, value: transactionType.toLowerCase() };
    });

    const [teamOptions, setTeamOptions] = useState(teamOptionData);
    const [transactionTypeOptions, setTransactionTypeOptions] = useState(transactionTypeData);

    return (
        <PlayerMapContext.Provider
            value={{opacity,
                    mapColor,
                    sizingAttribute,
                    setSizingAttribute,
                    allTeamOptions: JSON.parse(JSON.stringify(teamOptionData)),
                    teamOptions: teamOptions,
                    allTransactionTypes: JSON.parse(JSON.stringify(transactionTypeData)),
                    transactionTypeOptions: transactionTypeOptions,
                    setTeamOptions,
                    setTransactionTypeOptions
                }}
        >
            <section id={"scroll"}>
            <div id={"viz-column"}>
                    <div ref={refElement} id={"viz-tile"}>
                        { !isMobile && <PlayerMapControls teamData={teamData}/> }
                    </div>
                
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
      </PlayerMapContext.Provider>
    )
}

export { PlayerMapWrapper as default }
