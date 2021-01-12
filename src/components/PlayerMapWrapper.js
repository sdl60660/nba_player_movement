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
    const colors = chromatic.schemeCategory10;

    const [mapColor, setMapColor] = useState(chromatic.schemeCategory10[0]);
    const [geoData, setGeoData] = useState(_geoData);
    const [teamData, setTeamData] = useState(_teamData);
    const [playerData, setPlayerData] = useState(_playerData);
    const [width, setWidth] = useState(1300);
    const [height, setHeight] = useState(750);
    const [opacity, setOpacity] = useState(0.6);

    const onStepEnter = ({ element, index, direction }) => {
        console.log({ element, index, direction });
        setMapColor(() => {
            return colors[index%10];
        })
    }

    const refElement = useRef(null);
    let scroller = scrollama();

    useEffect(() => {
        vis = new PlayerMap(refElement.current, { width, height, mapColor, geoData, teamData, playerData });
        scroller
            .setup({
                step: ".transaction-card",
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
