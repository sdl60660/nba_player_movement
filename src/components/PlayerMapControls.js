import React, { useState, useEffect, useContext } from 'react';
import PlayerMapContext from '../context/playerMapContext';
import MultiSelect from "react-multi-select-component";


const PlayerMapControls = ({ teamData }) => {
    const context = useContext(PlayerMapContext);

    const onSelectChange = (event) => {
        context.setSizingAttribute(event.target.value);
    }

    // const [selectedTeams, setSelectedTeams] = useState(context.teamOptions);
    // const [selectedTransactionTypes, setSelectedTransactionTypes] = useState(context.allTransactionTypes);


    return (
        <div className={"map-control"}>
            <div className="map-control__select">
                <h4 className="map-control__header">Size Players By</h4>
                <select className="single-select" value={context.sizingAttribute} onChange={(e) => { onSelectChange(e) }} disabled={false}>
                    <option value="salary">Salary</option>
                    <option value="bpm">BPM (2020)</option>
                    <option value="vorp">VORP (2020)</option>
                    <option value="per">PER (2020)</option>
                </select>
            </div>
            <div className="map-control__select">
                <h4 className="map-control__header">Listed Teams</h4>
                <MultiSelect
                    options={context.allTeamOptions}
                    value={context.teamOptions}
                    onChange={context.setTeamOptions}
                    labelledBy={"Select"}
                    overrideStrings={{"allItemsAreSelected": "All teams' transactions are listed."}}
                    ClearIcon={<svg />}
                />
            </div>
            <div className="map-control__select">
                <h4 className="map-control__header">Listed Transaction Types</h4>
                <MultiSelect
                    options={context.allTransactionTypes}
                    value={context.transactionTypeOptions}
                    onChange={context.setTransactionTypeOptions}
                    labelledBy={"Select"}
                    overrideStrings={{"allItemsAreSelected": "All types of transactions are listed."}}
                />
            </div>
        </div>
    )
}

export default PlayerMapControls;

// <input onChange={(e) => setOpacity(e.target.value / 100)} value={opacity*100} type="range" id="opacity" name="opacity" min="0" max="100"/>
// <label htmlFor="opacity">Opacity</label>

// <input onChange={(e) => setMapColor(e.target.value)}type="color" id="color" name="color" value={mapColor}/>
// <label htmlFor="color">Color</label>