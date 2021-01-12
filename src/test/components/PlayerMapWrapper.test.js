import { screen } from '@testing-library/react';
import { shallow, render } from 'enzyme';
import PlayerMapWrapper from '../../components/PlayerMapWrapper';

const geoData = require('../fixtures/geoData.json');
const playerData = require('../fixtures/playerData.csv');
const teamData = require('../fixtures/teamData.csv');
const transactionData = require('../fixtures/transactionData.json');
// import geoData from ('../fixtures/geoData.json')

test('renders the PlayerMapWrapper element', () => {
  const wrapper = shallow(<PlayerMapWrapper
                            _playerData={playerData}
                            _teamData={teamData}
                            _geoData={geoData} 
                            transactionData={transactionData}  
                          />)
  expect(wrapper).toMatchSnapshot();
});