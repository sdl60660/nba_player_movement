import React, { useContext } from 'react';
import PlayerMapContext from '../context/playerMapContext';


const TransactionListing = ({ transaction }) => {
    const classList = transaction.players.map((player) => `transaction-log-${player.player_id}`).join(' ')
    const context = useContext(PlayerMapContext);
    // console.log(context);
    return (
        <li
            className={`transaction-card__transaction-item ${transaction.type}-listing  ${classList}`}
            // id={transaction.id}
            style={{display: true ? 'block' : 'none' }}
            test={context.sizingAttribute}
        >
            { transaction.text }
        </li>
    )
}

export { TransactionListing as default }


