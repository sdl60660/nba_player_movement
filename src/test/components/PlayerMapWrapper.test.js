import { screen } from '@testing-library/react';
import { shallow, render } from 'enzyme';
import PlayerMapWrapper from '../../components/PlayerMapWrapper';
const geoData = require('../fixtures/geoData.json');
// import geoData from ('../fixtures/geoData.json')

test('renders the PlayerMapWrapper element', () => {
  const wrapper = shallow(<PlayerMapWrapper _geoData={geoData} />)
  expect(wrapper).toMatchSnapshot();
});