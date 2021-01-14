// @flow

import React, { useState, useEffect, useReducer, useRef } from 'react';
import scrollama from 'scrollama';
import * as d3 from 'd3';
import * as chromatic from "d3-scale-chromatic";

import PlayerMapControls from './PlayerMapControls';
import PlayerMap from '../d3-components/PlayerMap';
import PlayerMapContext from '../context/playerMapContext';
import TransactionCard from './TransactionCard';

import transactionReducer from '../reducers/transactionReducer';


let vis;

const PlayerMapWrapper = ({ _geoData, _teamData, _playerData, transactionData }) => {

    const [mapColor, setMapColor] = useState(chromatic.schemeCategory10[0]);
    const [geoData, setGeoData] = useState(_geoData);
    const [teamData, setTeamData] = useState(_teamData);
    const [playerData, setPlayerData] = useState(_playerData);
    const [width, setWidth] = useState(1300);
    const [height, setHeight] = useState(750);
    const [opacity, setOpacity] = useState(0.5);

    const colors = chromatic.schemeCategory10;
    const transactionDates = Object.keys(transactionData);
    const playerDataIds = playerData.map((player) => player.player_id);

    let allAffectedTeams = [];
    let allAffectedPlayers = [];
    let polygonSelections = [];

    let scrollDirection = "down";

    const processStepTransactions = ({ element, index, direction }) => {
        d3.selectAll(".exit-polygon").remove();

        // console.log({ element, index, direction });
        let transactionDate = transactionDates[index];
        let transactions = transactionData[transactionDate];

        allAffectedTeams = [];
        allAffectedPlayers = [];
        
        setPlayerData((state) => {
            transactions.forEach((transaction) => {
                allAffectedTeams = allAffectedTeams.concat(transaction.affected_teams);

                // Maintain correct ordering on transactions if running upwards, for things like sign-and-trades
                const playerArray = direction === "down" ? transaction.players : transaction.players.reverse()

                transaction.players.forEach((player) => {
                    allAffectedPlayers.push(player.player_id);

                    state[playerDataIds.indexOf(player.player_id)].team = teamData
                        // Reverse transaction if running upwards
                        .find((team) => team.team_id === ( direction === "down" ? player.to_team : player.from_team));
                })
            })
            return state;
        })

        allAffectedTeams = [...new Set(allAffectedTeams.filter((team) => team !== "FA" && team !== "RET"))];
        allAffectedPlayers = [...new Set(allAffectedPlayers)];
        
        polygonSelections = vis.runTransactions(playerData, allAffectedTeams, allAffectedPlayers);

        console.log(allAffectedTeams, index, polygonSelections);
    }

    const processProgress = ({ element, index, progress, scrollDirection }) => {
        // console.log(element, index, progress);
        vis.updatePositions(allAffectedPlayers, allAffectedTeams, polygonSelections, progress, scrollDirection)
    }

    const refElement = useRef(null);
    let scroller = scrollama();

    useEffect(() => {
        vis = new PlayerMap(refElement.current, { width, height, mapColor, geoData, teamData, playerData, setPlayerData });
        scroller
            .setup({
                step: ".transaction-card",
                debug: false,
                progress: true,
                threshold: 6
            })
            .onStepEnter(({ element, index, direction }) => {
                scrollDirection = direction;
                if (element.getAttribute("class").includes("phantom")) {
                    return;
                }
                // else if (direction === "down") {
                else {
                    processStepTransactions({ element, index, direction })
                }
            })
            .onStepExit(({ element, index, direction }) => {
                if (element.getAttribute("class").includes("phantom")) {
                    return;
                }
                else if (direction === "up") {
                    return;
                    // processStepTransactions({ element, index, direction })
                }
            })
            .onStepProgress(({ element, index, progress }) => {
                processProgress({ element, index, progress, scrollDirection })
            });
        window.addEventListener("resize", scroller.resize);
    }, []);

    useEffect(() => {
        // console.log("Effect triggered", mapColor, opacity)
        vis.updateMapColor({ mapColor, opacity })
    }, [mapColor, opacity]);

    // useEffect(() => {
    //     // console.log("Effect triggered", mapColor, opacity)
    //     vis.runTransactions(playerData, affectedTeams, affectedPlayers)
    // }, [playerData]);

    return (
        <section id={"scroll"}>
          <div id={"viz-column"}>
            <PlayerMapContext.Provider value={{ opacity, setOpacity, mapColor, setMapColor, setHeight, setWidth }}>
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
