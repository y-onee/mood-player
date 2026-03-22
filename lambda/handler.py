import os
import json
import boto3
import requests
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Config ────────────────────────────────────────────────────────────────────
TABLE_NAME     = os.environ.get("DYNAMODB_TABLE", "mood-player-songs")
MODEL_ID       = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
EC2_FLASK_URL  = os.environ.get("EC2_FLASK_URL", "")
REGION         = "us-east-1"
RESULTS_LIMIT  = 5

dynamodb = boto3.resource("dynamodb", region_name=REGION)
bedrock  = boto3.client("bedrock-runtime", region_name=REGION)
table    = dynamodb.Table(TABLE_NAME)

# ── Helpers ───────────────────────────────────────────────────────────────────

def cors_response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def fetch_all_songs():
    response = table.scan(
        ProjectionExpression="song_id, title, artist, album, #yr, moods, energy, #lang",
        ExpressionAttributeNames={
            "#yr":   "year",
            "#lang": "language",
        }
    )
    return response.get("Items", [])


def build_prompt(mood, songs):
    songs_text = "\n".join(
        f"{i+1}. [{s['song_id']}] {s['title']} by {s['artist']} "
        f"| Moods: {s['moods']} | Energy: {s['energy']}"
        for i, s in enumerate(songs)
    )

    return f"""You are a BTS music recommendation assistant.

A user is feeling: "{mood}"

Here is a list of BTS songs with their mood tags and energy levels:
{songs_text}

Pick the {RESULTS_LIMIT} songs that best match the user's feeling.
Consider the emotional meaning behind their words, not just exact keyword matches.

Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  {{
    "song_id": "...",
    "title": "...",
    "artist": "...",
    "reason": "One sentence explaining why this matches the mood"
  }}
]"""


def call_bedrock(prompt):
    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"maxTokens": 1024, "temperature": 0.5},
        }),
    )
    body    = json.loads(response["body"].read())
    content = body.get("output", {}).get("message", {}).get("content", [])
    text    = content[0]["text"] if content else ""
    text    = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)


def get_youtube_data(title, artist):
    """Calls EC2 Flask server to search YouTube."""
    query = f"{title} {artist} BTS official"
    try:
        res  = requests.get(
            f"{EC2_FLASK_URL}/youtube-search",
            params={"query": query},
            timeout=10
        )
        data = res.json()
        return data.get("videoId"), data.get("thumbnail")
    except Exception as e:
        logger.error("EC2 YouTube search failed: %s", str(e))
        return None, None


def enrich_with_youtube(picks, all_songs):
    songs_map = {s["song_id"]: s for s in all_songs}
    results   = []

    for pick in picks:
        song_id  = str(pick.get("song_id", ""))
        metadata = songs_map.get(song_id, {})
        title    = pick.get("title", metadata.get("title", ""))
        artist   = pick.get("artist", metadata.get("artist", ""))

        video_id, thumbnail = get_youtube_data(title, artist)

        results.append({
            "song_id":     song_id,
            "title":       title,
            "artist":      artist,
            "album":       metadata.get("album", ""),
            "year":        metadata.get("year", ""),
            "energy":      metadata.get("energy", ""),
            "moods":       metadata.get("moods", ""),
            "reason":      pick.get("reason", ""),
            "video_id":    video_id,
            "thumbnail":   thumbnail,
            "youtube_url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
        })

    return results


# ── Handler ───────────────────────────────────────────────────────────────────

def handler(event, context):
    logger.info("Event: %s", json.dumps(event))

    # Parse mood from request body
    try:
        body = json.loads(event.get("body") or "{}")
        mood = body.get("mood", "").strip()
    except json.JSONDecodeError:
        return cors_response(400, {"error": "Invalid JSON body."})

    if not mood:
        return cors_response(400, {"error": "'mood' field is required."})

    if len(mood) > 500:
        return cors_response(400, {"error": "'mood' must be 500 characters or fewer."})

    # Fetch all songs from DynamoDB
    try:
        songs = fetch_all_songs()
    except Exception as e:
        logger.exception("DynamoDB fetch failed")
        return cors_response(500, {"error": "Failed to fetch songs.", "detail": str(e)})

    if not songs:
        return cors_response(500, {"error": "No songs found. Run the seeding script first."})

    # Call Bedrock to pick best matches
    try:
        prompt = build_prompt(mood, songs)
        picks  = call_bedrock(prompt)
    except Exception as e:
        logger.exception("Bedrock call failed")
        return cors_response(500, {"error": "Failed to get recommendations.", "detail": str(e)})

    # Enrich with YouTube data via EC2
    try:
        results = enrich_with_youtube(picks, songs)
    except Exception as e:
        logger.exception("YouTube enrichment failed")
        return cors_response(500, {"error": "Failed to fetch YouTube data.", "detail": str(e)})

    return cors_response(200, {
        "mood":            mood,
        "recommendations": results,
    })
