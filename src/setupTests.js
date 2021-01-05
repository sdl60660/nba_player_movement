import '@testing-library/jest-dom';
import Adapter from 'enzyme-adapter-react-16';
import Enzyme, { configure, shallow, mount, render } from 'enzyme';
import "jest-enzyme";

Enzyme.configure(
    {
        adapter: new Adapter() 
    }
)

export { shallow, mount, render };
export default Enzyme;