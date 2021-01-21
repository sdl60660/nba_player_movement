import React, { useContext } from 'react';
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
                <select className="single-select" id={"attribute-select"} value={context.sizingAttribute} onChange={(e) => { onSelectChange(e) }} disabled={false}>
                    <option value="salary">Salary</option>
                    <optgroup label="2019-20 Stats">
                        <option value="2020_bpm">Box Plus/Minus</option>
                        <option value="2020_obpm">Offensive Box Plus/Minus</option>
                        <option value="2020_dbpm">Defensive Box Plus/Minus</option>
                        <option value="2020_vorp">VORP</option>
                        <option value="2020_pts_per_g">Points Per Game</option>
                        <option value="2020_trb_per_g">Rebounds Per Game</option>
                        <option value="2020_ast_per_g">Assists Per Game</option>
                        <option value="2020_mp_per_g">Minutes Per Game</option>
                        { /* <option value="2020_per">PER (2020)</option> */}
                    </optgroup>
                    <optgroup label="2020-21 Stats">
                        <option value="2021_bpm">Box Plus/Minus</option>
                        <option value="2021_obpm">Offensive Box Plus/Minus</option>
                        <option value="2021_dbpm">Defensive Box Plus/Minus</option>
                        <option value="2021_vorp">VORP</option>
                        <option value="2021_pts_per_g">Points Per Game</option>
                        <option value="2021_trb_per_g">Rebounds Per Game</option>
                        <option value="2021_ast_per_g">Assists Per Game</option>
                        <option value="2021_mp_per_g">Minutes Per Game</option>
                        { /* <option value="2021_per">PER (2021)</option> */}
                    </optgroup>
                    
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