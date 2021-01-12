import React, { useState, useEffect, useReducer, useRef } from 'react';
import scrollama from 'scrollama';
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
    const [opacity, setOpacity] = useState(0.6);

    const colors = chromatic.schemeCategory10;
    const transactionDates = Object.keys(transactionData);
    const playerDataIds = playerData.map((player) => player.player_id);

    const onStepEnter = ({ element, index, direction }) => {
        // console.log({ element, index, direction });
        let transactionDate = transactionDates[index];
        let transactions = transactionData[transactionDate];

        let allAffectedTeams = [];
        let allAffectedPlayers = [];
        
        setPlayerData((state) => {
            transactions.forEach((transaction) => {
                allAffectedTeams = allAffectedTeams.concat(transaction.affected_teams);

                transaction.players.forEach((player) => {
                    console.log(playerDataIds.indexOf(player.player_id));
                    allAffectedPlayers.push(player.player_id);

                    state[playerDataIds.indexOf(player.player_id)].team = teamData
                        .find((team) => team.team_id === ( direction === "down" ? player.to_team : player.from_team));
                })
            })
            return state;
        })

        allAffectedTeams = [...new Set(allAffectedTeams.filter((team) => team !== "FA" && team !== "RET"))];
        allAffectedPlayers = [...new Set(allAffectedPlayers)];
        console.log(playerData, allAffectedTeams, allAffectedPlayers);
        vis.runTransactions(playerData, allAffectedTeams, allAffectedPlayers);
        
        setMapColor(() => {
            return colors[index%10];
        })
    }

    const refElement = useRef(null);
    let scroller = scrollama();

    useEffect(() => {
        vis = new PlayerMap(refElement.current, { width, height, mapColor, geoData, teamData, playerData, setPlayerData });
        scroller
            .setup({
                step: ".transaction-card",
                debug: true
            })
            .onStepEnter(({ element, index, direction }) => {
                onStepEnter({ element, index, direction })
            })
            .onStepExit((response) => {
                // { element, index, direction }
            });
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
                <div key={"phantom-end"} className={"step phantom"} />
          </div>
      </section>
    )
}

export { PlayerMapWrapper as default }
