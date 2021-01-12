const transactionReducer = (state, action) => {
    switch (action.type) {
        case "TRADE":
            return action.notes;
        case "SIGNING":
            return [ ...state, action.note];
        case "RELEASE":
            return state.filter((note) => note !== action.note);
        case "RETIREMENT":
            return state
        default:
            return state;
    }
  }

export { transactionReducer as default };