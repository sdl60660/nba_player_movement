import React, { useState, useEffect, useReducer, useRef } from 'react';

const TransactionCard = ({ transactionDate, transactions, className }) => {
    return (
        <div className={className}>
            <strong>{transactionDate}</strong>
            <ul>
                { transactions.map((transaction) => <li>{ transaction.text }</li> ) }
            </ul>
        </div>
    )
}

export { TransactionCard as default }