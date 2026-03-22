import boto3
import openpyxl

# Config
TABLE_NAME  = "mood-player-songs"
REGION      = "us-east-1"
EXCEL_FILE  = "songs_dataset.xlsx"

# Connect to DynamoDB
boto3.setup_default_session(profile_name="fcscrs_IsbUsersPS")
dynamodb = boto3.resource("dynamodb", region_name=REGION)
table    = dynamodb.Table(TABLE_NAME)

# Read Excel
wb = openpyxl.load_workbook(EXCEL_FILE)
ws = wb["Sheet1"]

# Skip header row
rows = list(ws.iter_rows(values_only=True))[1:]

# Batch write to DynamoDB
with table.batch_writer() as batch:
    for row in rows:
        song_id, title, album, year, artist, moods, energy, language = row

        # Skip empty rows
        if not song_id:
            continue

        batch.put_item(Item={
            "song_id":  str(song_id),
            "title":    str(title),
            "album":    str(album),
            "year":     str(year),
            "artist":   str(artist),
            "moods":    str(moods),
            "energy":   str(energy),
            "language": str(language),
        })
        print(f"Seeded: {title} — {artist}")

print(f"\nDone! {len(rows)} songs seeded into {TABLE_NAME}")