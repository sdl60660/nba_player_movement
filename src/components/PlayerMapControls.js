import React, { useEffect, useContext } from 'react';
import PlayerMapContext from '../context/playerMapContext';


const PlayerMapControls = () => {
    const { opacity, setOpacity, mapColor, setMapColor, setHeight, setWidth } = useContext(PlayerMapContext);

    return (
        <div>
            <input onChange={(e) => setOpacity(e.target.value / 100)} value={opacity*100} type="range" id="opacity" name="opacity" min="0" max="100"/>
            <label for="opacity">Opacity</label>

            <input onChange={(e) => setMapColor(e.target.value)}type="color" id="color" name="color" value={mapColor}/>
            <label for="color">Color</label>
        </div>
    )
}

export default PlayerMapControls;