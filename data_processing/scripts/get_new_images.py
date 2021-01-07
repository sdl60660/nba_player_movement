import requests
import csv
import unidecode
import shutil

with open('../data/players.csv', 'r', encoding='utf-8-sig') as f:
    players = [x for x in csv.DictReader(f)]
    new_photo_players = [x for x in players if 'jpg' in x['internal_image_link']]

for player in new_photo_players:
    formatted_player_name = unidecode.unidecode(player['player'].replace(' ', '-').replace('\'','').replace('.',''))
    image_url = f"https://www.2kratings.com/wp-content/uploads/{formatted_player_name}-2K-Rating.png"

    r = requests.get(image_url, stream=True)
    if r.status_code == 200:
        with open(f"../data/new_images/{player['player_id']}.png", 'wb') as f:
            r.raw.decode_content = True
            shutil.copyfileobj(r.raw, f) 

# print(len(new_photo_players))