import { screen } from '@testing-library/react';
import { shallow, render } from 'enzyme';
import { json, csv } from 'd3-fetch';
import { groupBy } from 'lodash';

import PlayerMapWrapper from '../../components/PlayerMapWrapper';
import { formatPlayerData } from '../../index';


// const promises = [
//   json('../fixtures/geoData.json'),
//   csv('../fixtures/playerData.csv'),
//   csv('../fixtures/teamData.csv'),
//   json('../fixtures/transactionData.json')
// ]

// Promise.all(promises).then((allData) => {
//   geoData = allData[0];
//   teamData = allData[1];
//   playerData = formatPlayerData(playerData, teamData);
//   transactionData = groupBy(transactionData, d => d.date);
// });

// const geoData = json('../fixtures/geoData.json');
// let playerData = csv('../fixtures/playerData.csv');
// const teamData = csv('../fixtures/teamData.csv');
// let transactionData = json('../fixtures/transactionData.json');
// import geoData from ('../fixtures/geoData.json')


// beforeEach(() => {
//   startAddExpense = jest.fn();
//   history = {
//       push: jest.fn()
//   }
//   wrapper = shallow(<AddExpensePage startAddExpense={startAddExpense} history={history} />);
// })

// let geoData, teamData, playerData, transactionData, wrapper;

// beforeEach((done) => {
//   const promises = [
//     json("../fixtures/geoData.json"),
//     csv("../fixtures/playerData.csv"),
//     csv("../fixtures/teamData.csv"),
//     json("../fixtures/transactionData.json")
//   ];
  
//   Promise.all(promises).then((allData) => {
//     geoData = allData[0];
//     teamData = allData[1];
//     playerData = formatPlayerData(playerData, teamData);
//     transactionData = groupBy(transactionData, d => d.date);

//     done();
//   })
// })

test('renders the PlayerMapWrapper element', () => {
  // playerData = formatPlayerData(playerData, teamData);
  // transactionData = groupBy(transactionData, d => d.date);

  const wrapper = shallow(<PlayerMapWrapper
                            _playerData={playerData}
                            _teamData={teamData}
                            _geoData={geoData} 
                            transactionData={transactionData}  
                          />)
  expect(wrapper).toMatchSnapshot();
});