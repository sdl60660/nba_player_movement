import csv
import json
from datetime import datetime
import requests
from bs4 import BeautifulSoup


def process_multi_team(transaction_element):
    all_links = transaction_element.find_all("a")

    breakpoints = []
    for i, link in enumerate(all_links):
        if 'data-attr-from' in link.attrs:
            breakpoints.append(i)
    
    players = []
    for i, point in enumerate(breakpoints):
        if i == len(breakpoints)-1:
            link_chunk = all_links[point:]
        else:
            link_chunk = all_links[point:breakpoints[i+1]]
        
        players += process_trade(link_chunk)
    
    return players


def process_trade(links):
    players = []

    for i, link in enumerate(links):
        if 'data-attr-from' in link.attrs:
            from_team_id = link['data-attr-from']
            from_team_index = i
        elif 'data-attr-to' in link.attrs:
            to_team_id = link['data-attr-to']
            to_team_index = i
    
    for link in links[from_team_index+1:to_team_index]:
        player_id = link['href'].split('/')[-1].replace('.html', '')
        if player_id in player_dict.keys():
            players.append({
                "player_id": player_id,
                "from_team": player_dict[player_id]['team_id'],
                "to_team": to_team_id
            })

    for link in links[to_team_index+1:]:
        player_id = link['href'].split('/')[-1].replace('.html', '')
        if player_id in player_dict.keys():
            players.append({
                "player_id": player_id,
                "from_team": player_dict[player_id]['team_id'],
                "to_team": from_team_id
            })

    return players


def format_transaction_id(transaction_type, formatted_date, player_data):
    return f"{transaction_type}_{formatted_date}_{'-'.join(sorted([x['player_id'] for x in player_data]))}"
    

def process_bbref_transaction(transaction, transaction_text):
    for phrase in transaction_types:
        if phrase in transaction_text:
            transaction_type = phrase
            break
    
    player_data = []


    if transaction_type == "signed" or transaction_type == "claimed" or transaction_type == "contract extension":
        player_id = transaction.find_all("a")[-1]['href'].split('/')[-1].replace('.html', '')

        # Transaction logs don't specify two-way contracts on waiver claims, so filter these and continue here
        if player_id not in player_dict.keys():
            return

        to_team = transaction.find_all("a")[0]['href'].split('/')[2]
        player_movement = {
            "player_id": player_id,
            "from_team": player_dict[player_id]['team_id'],
            "to_team": to_team,
        }
        player_data = [player_movement]

    elif transaction_type == "waived":
        player_id = transaction.find_all("a")[-1]['href'].split('/')[-1].replace('.html', '')

        # Transaction logs don't specify Exhitbit 10 contracts on waives, so filter these and continue here.
        if player_id not in player_dict.keys():
            return

        to_team = 'FA'
        player_movement = {
            "player_id": player_id,
            "from_team": player_dict[player_id]['team_id'],
            "to_team": to_team,
        }
        player_data = [player_movement]

    elif transaction_type == "traded":
        links = transaction.find_all("a")
        player_data = process_trade(links)

    elif transaction_type == "-team trade":
        transaction_type = "n-team trade"
        player_data = process_multi_team(transaction)

    affected_teams = []
    for player in player_data:
        affected_teams += [player['from_team'], player['to_team']]

    transaction_id = format_transaction_id(transaction_type, formatted_date, player_data)

    transaction_dict = {
        "id": transaction_id,
        "type": transaction_type,
        "date": formatted_date,
        "players": player_data,
        "affected_teams": list(set(affected_teams)),
        "text": transaction_text
    }

    if transaction_id in processed_transaction_ids:
        return None
    else:
        for player in player_data:
            player_dict[player["player_id"]]["team_id"] = player["to_team"]
        
        return transaction_dict


def find_player(player_name_string):
    # Occasionally there's more than one name option, separated by a slash and (even more rarely) there's sometimes a trailing parenthetical after name
    name_options = [x.split(' (')[0] for x in player_name_string.split(' / ')]
    
    for player in player_dict.values():
        if player['player'] in name_options:
            return player


def find_team(team_name):
    if team_name.strip() == 'Blazers':
        team_name = 'Trailblazers'

    for team in team_data:
        if str(team_name).strip() == str(team['team_nickname']).strip():
            return team


def process_prosports_transaction(transaction):
    transaction_text = transaction['notes']

    for phrase in transaction_types:
        if phrase in transaction_text:
            transaction_type = phrase
            break
    
    involved_player = (transaction['relinquished'] + transaction['acquired'])[0]
    player = find_player(involved_player)
    
    # Seems to always be g-league/exhibit 10 player
    if not player:
        return None
    else:
        player_id = player['player_id']

    team = find_team(transaction['team'])
    team_id = team['team_id']
    
    affected_teams = [team_id, "FA"]
    transaction_text = transaction['notes'] + '.'
    salary_data = None
    
    if transaction_type == "exercised":
        transaction_type = "exercised option"
        from_team = team_id
        to_team = team_id
        affected_teams = [team_id]
        
        if transaction_text.startswith("player"):
            transaction_text = transaction_text.replace("player", f"{player['player']} ({team['team_nickname']})")
        else:
            transaction_text = transaction_text.replace("team exercised", f"{team['team_nickname']} exercised {player['player']}'s")


    elif transaction_type == "declined contract option":
        transaction_type = "declined option"
        from_team = team_id
        to_team = "FA"

        if transaction_text.startswith("player"):
            transaction_text = transaction_text.replace("player", f"{player['player']} ({team['team_nickname']})")
        else:
            transaction_text = transaction_text.replace("team declined", f"{team['team_nickname']} declined {player['player']}'s")

    elif transaction_type == "waived":
        # If player isn't on this team in roster start, they're on a two-way or Exhibit 10 contract and this waiver shouldn't be processed
        if player['team_id'] != team_id:
            return None

        from_team = team_id
        to_team = "FA"

        transaction_text = f"The {team['team_full_name']} waived {player['player']}."
    
    elif transaction_type == "claimed":
        from_team = player_dict[player_id]['team_id']
        to_team = team_id

        affected_teams = [from_team, to_team]
        transaction_text = f"The {team['team_full_name']} claimed {player['player']} off waivers."

    elif transaction_type == "signed":
        from_team = player_dict[player_id]['team_id']
        to_team = team_id
        affected_teams = [from_team, to_team]

        contract_clause = transaction_text.split(' to a ')[-1]

        if contract_clause[1:6] != '-year':
            verb = contract_clause.split()[0]
            transaction_text = f"The {team['team_full_name']} {verb} {player['player']}."
        else:
            transaction_text = f"The {team['team_full_name']} signed {player['player']} to a {contract_clause}"

            # EX clause: "1-year $2.3M contract." OR "1-year contract." OR "3-year $24.7M contract." (can't tell current annual salary on multi-years like this)
            if contract_clause[0] == '1' and contract_clause[7] == '$':
                new_salary = int(1000000*float(contract_clause.split()[1].replace("$", "").replace("M", "").split("-")[0]))
                salary_data = {
                    'start_salary': player_dict[player_id]['current_salary'],
                    'end_salary': new_salary
                }
                player_dict[player_id]['current_salary'] = new_salary


    elif transaction_type == "contract extension":
        from_team = team_id
        to_team = team_id

        transaction_text = f"The {team['team_full_name']} signed {player['player']} to a {transaction_text.split(' to a ')[-1]}."


    player_movement = {
        "player_id": player_id,
        "from_team": from_team,
        "to_team": to_team,
    }

    player_data = [player_movement]

    transaction_dict = {
        "id": format_transaction_id(transaction_type, transaction['date'], player_data),
        "type": transaction_type,
        "date": transaction['date'],
        "players": player_data,
        "affected_teams": affected_teams,
        "text": transaction_text
    }

    if salary_data:
        transaction_dict['salary_data'] = salary_data

    for player in player_data:
        player_dict[player["player_id"]]["team_id"] = player["to_team"]
    
    return transaction_dict


transaction_types = ['exercised', 'declined contract option', 'contract extension', 'signed', 'waived', 'claimed', '-team trade', 'traded']
all_transactions = []
processed_transaction_ids = []
signed_then_waived = []

with open('../data/players_start.csv', 'r', encoding='utf-8-sig') as f:
    player_dict = {x['player_id']: x for x in csv.DictReader(f)}
    for player_id, player in player_dict.items():
        # If they went into the season without a salary, technically their salary was 0, but setting it to 1 helps avoid some divide-by-zero issues without meaninfully affecting anything
        player_dict[player_id]['current_salary'] = (1 if player['2021_preseason_salary'] == '' else player['2021_preseason_salary'])

with open('../data/team_data.csv', 'r', encoding='utf-8-sig') as f:
    team_data = [x for x in csv.DictReader(f)]

with open('../data/supplementary_transaction_data.json', 'r') as f:
    prosports_transactions = [x for x in json.load(f) if 'waived' in x['notes'] or 'contract option' in x['notes'] or 'signed' in x['notes'] or 'claimed' in x['notes']]
    prosports_transactions = [x for x in prosports_transactions if '10-day contract' not in x['notes'] and 'Exhibit 10' not in x['notes'] and 'two way contract' not in x['notes'] and 'option for 2021-22' not in x['notes']]


r = requests.get("https://www.basketball-reference.com/leagues/NBA_2021_transactions.html")
soup = BeautifulSoup(r.text, 'html.parser')

content = soup.find("div", attrs={"id": "content"}).find("ul", attrs={"class": "page_index"})
transaction_dates = content.find_all("li")


for date in transaction_dates[::-1]:
    date_string = date.find("span").text

    if date_string == "?":
        continue

    formatted_date = datetime.strftime(datetime.strptime(date_string, "%B %d, %Y"), "%Y-%m-%d")
    print(date_string)

    prosports_date_transactions = [x for x in prosports_transactions if x['date'] == formatted_date]
    prosports_waivers = [x for x in prosports_date_transactions if 'waived' in x['notes'] or 'claimed' in x['notes']]
    prosports_nonwaivers = [x for x in prosports_date_transactions if 'waived' not in x['notes'] and 'claimed' not in x['notes']]
    
    for transaction in prosports_nonwaivers:
        transaction_dict = process_prosports_transaction(transaction)
        if transaction_dict:
            processed_transaction_ids.append(transaction_dict['id'])
            all_transactions.append(transaction_dict)
    
    bbref_transactions = date.find_all("p")
    for transaction in bbref_transactions:
        transaction_text = transaction.text

        if " hired " in transaction_text or "Exhibit 10" in transaction_text or "two-way contract" in transaction_text:
            continue
        else:
            transaction_dict = process_bbref_transaction(transaction, transaction_text)
            if transaction_dict:
                all_transactions.append(transaction_dict)
    
    for transaction in prosports_waivers:
        transaction_dict = process_prosports_transaction(transaction)
        if transaction_dict:
            processed_transaction_ids.append(transaction_dict['id'])
            all_transactions.append(transaction_dict)
        
# all_transactions.sort(key=lambda x: (datetime.strptime(x['date'], "%Y-%m-%d"))

with open('../data/transactions.json', 'w') as f:
    json.dump(all_transactions, f)

with open('../../public/data/transactions.json', 'w') as f:
    json.dump(all_transactions, f)