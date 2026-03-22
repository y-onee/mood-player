import os
import boto3
import requests

TABLE_NAME      = os.environ.get("DYNAMODB_TABLE", "mood-player-songs")
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
REGION          = "us-east-1"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table    = dynamodb.Table(TABLE_NAME)

def search_youtube(title, artist):
    query  = f"{title} {artist} BTS official"
    url    = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part":       "snippet",
        "q":          query,
        "type":       "video",
        "maxResults": 1,
        "key":        YOUTUBE_API_KEY,
    }
    res   = requests.get(url, params=params, timeout=10)
    data  = res.json()
    items = data.get("items", [])
    if not items:
        return None, None
    video_id  = items[0]["id"]["videoId"]
    thumbnail = items[0]["snippet"]["thumbnails"]["high"]["url"]
    return video_id, thumbnail


def fetch_all_songs():
    response = table.scan()
    return response.get("Items", [])


def update_song(song_id, video_id, thumbnail):
    table.update_item(
        Key={"song_id": song_id},
        UpdateExpression="SET video_id = :v, thumbnail = :t",
        ExpressionAttributeValues={
            ":v": video_id,
            ":t": thumbnail,
        }
    )


def main():
    print("Fetching all songs from DynamoDB...")
    songs = fetch_all_songs()
    print(f"Found {len(songs)} songs. Starting YouTube pre-fetch...")

    for i, song in enumerate(songs):
        title    = song.get("title", "")
        artist   = song.get("artist", "")
        song_id  = song.get("song_id", "")

        print(f"[{i+1}/{len(songs)}] Searching YouTube for: {title} — {artist}")

        video_id, thumbnail = search_youtube(title, artist)

        if video_id:
            update_song(song_id, video_id, thumbnail)
            print(f"  Stored video_id: {video_id}")
        else:
            print(f"  No results found, skipping.")

    print("Done! All songs updated with YouTube data.")


if __name__ == "__main__":
    main()