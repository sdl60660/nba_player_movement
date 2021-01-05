import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
// import App from './App';
import reportWebVitals from './reportWebVitals';

import PlayerMapWrapper from './components/PlayerMapWrapper'
import { json } from 'd3-fetch';


// Begin loading datafiles
const promises = [
  json("data/us_states.json")
];


Promise.all(promises).then((allData) => {
    const geoData = allData[0];
    // const map = new playerMap("#map-tile", allData[0]);

    ReactDOM.render(<PlayerMapWrapper _geoData={geoData}/>, document.getElementById('root'));
    // ReactDOM.render(<p/>, document.getElementById('root'));

});



// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
