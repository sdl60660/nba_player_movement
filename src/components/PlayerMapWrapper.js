import React, { useState, useEffect, useRef } from 'react';
import * as chromatic from "d3-scale-chromatic";

import PlayerMapControls from './PlayerMapControls';
import PlayerMap from '../d3-components/PlayerMap';
import PlayerMapContext from '../context/playerMapContext';


let vis;

const PlayerMapWrapper = ({ _geoData, _teamData, _playerData, scroller, parentElement="player-map" }) => {
    // const colors = ["#f23d23", "#3434ff", "#67f402"];
    // const colors = d3.interpolate("red", "green", )(d3.randomUniform()())
    const colors = chromatic.schemeCategory10;

    const [mapColor, setMapColor] = useState('#0000ff');
    const [geoData, setGeoData] = useState(_geoData);
    const [teamData, setTeamData] = useState(_teamData);
    const [playerData, setPlayerData] = useState(_playerData);
    const [width, setWidth] = useState(1400);
    const [height, setHeight] = useState(850);
    const [opacity, setOpacity] = useState(0.8);

    scroller
        .onStepEnter(({ element, index, direction }) => {
            // console.log({ element, index, direction });
            // console.log(colors[index]);
            setMapColor(() => {
                return colors[index];
            })
        })
        .onStepExit(({ element, index, direction }) => {
            // console.log({ element, index, direction })
        });

    const refElement = useRef(null);

    useEffect(() => {
        vis = new PlayerMap(refElement.current, { width, height, mapColor, geoData, teamData, playerData });
    }, []);

    useEffect(() => {
        // console.log("Effect triggered", mapColor, opacity)
        vis.updateMapColor({ mapColor, opacity })
    }, [mapColor, opacity]);

    return (
        <PlayerMapContext.Provider value={{ opacity, setOpacity, mapColor, setMapColor, setHeight, setWidth }}>
            <div ref={refElement} id={"viz-tile"}>
                {/* <PlayerMapControls /> */}
            </div>
        </PlayerMapContext.Provider>
    )
}

export { PlayerMapWrapper as default }
