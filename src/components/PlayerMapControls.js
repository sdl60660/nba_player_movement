import React, { useContext } from 'react';
import PlayerMapContext from '../context/playerMapContext';


const PlayerMapControls = () => {
    const { opacity, setOpacity, mapColor, setMapColor, sizingAttribute, setSizingAttribute } = useContext(PlayerMapContext);

    const onSelectChange = (event) => {
        setSizingAttribute(event.target.value);
    }

    return (
        <div>
            <select value={sizingAttribute} onChange={(e) => { onSelectChange(e) }}>
                <option value="salary">Salary</option>
                <option value="vorp">VORP (2020)</option>
                <option value="per">PER (2020)</option>
            </select>
        </div>
    )
}

export default PlayerMapControls;

// <input onChange={(e) => setOpacity(e.target.value / 100)} value={opacity*100} type="range" id="opacity" name="opacity" min="0" max="100"/>
// <label htmlFor="opacity">Opacity</label>

// <input onChange={(e) => setMapColor(e.target.value)}type="color" id="color" name="color" value={mapColor}/>
// <label htmlFor="color">Color</label>