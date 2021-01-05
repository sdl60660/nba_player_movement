import React, { useState, useEffect, useRef, useContext } from 'react';
import PlayerMapControls from './PlayerMapControls';
import PlayerMap from '../d3-components/PlayerMap';
import PlayerMapContext from '../context/playerMapContext';


let vis;

const PlayerMapWrapper = ({ _geoData, parentElement="player-map" }) => {

    const [mapColor, setMapColor] = useState('#0000ff');
    const [geoData, setGeoData] = useState(_geoData);
    const [width, setWidth] = useState(1400);
    const [height, setHeight] = useState(800);
    const [opacity, setOpacity] = useState(1.0);

    const refElement = useRef(null);

    useEffect(() => {
        vis = new PlayerMap(refElement.current, { width, height, mapColor, geoData });
    }, []);

    useEffect(() => {
        vis.updateMapColor({ mapColor, opacity })
    }, [mapColor, opacity]);

    return (
        <PlayerMapContext.Provider value={{ opacity, setOpacity, mapColor, setMapColor, setHeight, setWidth }}>
            <div ref={refElement} id={"viz-tile"}>
                <PlayerMapControls />
            </div>
        </PlayerMapContext.Provider>
    )
}

export { PlayerMapWrapper as default }


// const svg = d3.select("#map-tile").append("svg")
//     .attr("id", "map-svg")
//     .attr("height", 300)
//     .attr("width", 300)

// const circle = svg.append("circle")
//     .attr("cx", 12)
//     .attr("cy", 232)
//     .attr("r", 5)
//     .style("fill", "red");
