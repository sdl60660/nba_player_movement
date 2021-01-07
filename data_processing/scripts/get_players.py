import csv
import shutil
import requests
from bs4 import BeautifulSoup


def process_player_row(row):
    player_data = { x['data-stat']: x.text for x in row.find_all('td') }
    return player_data


# def get_player_data(player_id):
#     r = requests.get(f"https://www.basketball-reference.com/players/t/{player_id}.html")
#     soup = BeautifulSoup(r.text, "html.parser")


player_dict = {}

# Get active player data
r = requests.get("https://www.basketball-reference.com/leagues/NBA_2021_advanced.html")
soup = BeautifulSoup(r.text, "html.parser")
table = soup.find("table", attrs={"id": "advanced_stats"})

rows = soup.find("tbody").find_all("tr", attrs={"class": "full_table"})
for row in rows:
    player_id = row.find_all("td")[0]['data-append-csv']
    player_data = process_player_row(row)
    player_data['player_id'] = player_id
    player_dict[player_id] = player_data


r = requests.get("https://www.basketball-reference.com/contracts/players.html", allow_redirects=False)
soup = BeautifulSoup(r.text, "html.parser")
contracts = soup.find('table').find("tbody")
rows = contracts.find_all("tr", class_=lambda x: not x)
for row in rows:
    player_id = row.find("td")['data-append-csv']

    if player_id not in player_dict.keys():
        player_dict[player_id] = {
            'player_id': player_id,
            'player': row.find("td").find_all("a")[-1].text,
            'team_id': row.find_all("td")[1].find("a").text
            }
    try:
        player_dict[player_id]['salary'] = row.find_all("td")[2]['csk']
    except KeyError:
        player_dict[player_id]['salary'] = '0'


# Get player photos
for player_id, player in player_dict.items():
    print(player_id)
    # image_url = f"https://www.basketball-reference.com/req/202101021/images/players/{player_id}.jpg"
    formtted_player_name = player['player'].replace(' ', '-').replace('\'','')
    image_url = f"https://www.2kratings.com/wp-content/uploads/{formtted_player_name}-2K-Rating.png"

    r = requests.get(image_url, stream=True)
    if r.status_code == 200:
        player_dict[player_id]['img_link'] = image_url
        player_dict[player_id]['internal_image_link'] = f"/images/{player_id}.png"
        # with open(f'../../public/images/{player_id}.png', 'wb') as f:
        #     r.raw.decode_content = True
        #     shutil.copyfileobj(r.raw, f) 
    else:
        player_dict[player_id]['img_link'] = f"https://www.basketball-reference.com/req/202101021/images/players/{player_id}.jpg"
        player_dict[player_id]['internal_image_link'] = f"/images/{player_id}.jpg"



for player_id, player in player_dict.items():
    if 'salary' not in player.keys():
        player_dict[player_id]['salary'] = '0'
        

for filename in ['../data/players.csv', '../../public/data/players.csv']:
    with open(filename, 'w') as f:
        out_data = list(player_dict.values())

        out_csv = csv.DictWriter(f, fieldnames=list(out_data[0].keys()))
        out_csv.writeheader()

        for row in out_data:
            out_csv.writerow(row)

