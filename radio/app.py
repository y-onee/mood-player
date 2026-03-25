import asyncio
import json
import uuid
import websockets
from websockets.datastructures import Headers
from websockets.http11 import Response

stations = {}
connections = set()


async def send_json(connection, payload):
    try:
        await connection.send(json.dumps(payload))
        return True
    except websockets.exceptions.ConnectionClosed:
        return False


async def notify_listeners(station_id, message):
    station = stations.get(station_id)
    if not station:
        return
    stale = set()
    for listener in station.get("listeners", set()):
        delivered = await send_json(listener, message)
        if not delivered:
            stale.add(listener)
    for listener in stale:
        station["listeners"].discard(listener)


def stations_list():
    return [
        {
            "station_id": sid,
            "name":       s["name"],
            "song":       s["song"],
            "listener_count": len(s["listeners"]),
        }
        for sid, s in stations.items()
    ]


async def broadcast_station_list():
    payload = {
        "type": "stations_list",
        "stations": stations_list(),
    }
    stale = set()
    for connection in connections:
        delivered = await send_json(connection, payload)
        if not delivered:
            stale.add(connection)
    for connection in stale:
        connections.discard(connection)
        for station in stations.values():
            station["listeners"].discard(connection)


async def process_request(connection, request):
    if request.path == "/health":
        headers = Headers()
        headers["Content-Type"] = "text/plain"
        return Response(200, "OK", headers, b"ok")

    if request.path != "/radio":
        headers = Headers()
        headers["Content-Type"] = "text/plain"
        return Response(404, "Not Found", headers, b"not found")

    return None


async def handler(websocket):
    station_id = None
    is_broadcaster = False
    connections.add(websocket)

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "Invalid JSON"}))
                continue

            msg_type = msg.get("type")

            if msg_type == "broadcast":
                if is_broadcaster and station_id and station_id in stations:
                    stations[station_id]["name"] = msg.get("name", stations[station_id]["name"])
                    stations[station_id]["song"] = msg.get("song", stations[station_id]["song"])
                else:
                    station_id     = str(uuid.uuid4())
                    is_broadcaster = True
                    stations[station_id] = {
                        "name":        msg.get("name", "Anonymous Radio"),
                        "song":        msg.get("song", {}),
                        "broadcaster": websocket,
                        "listeners":   set(),
                    }
                await send_json(websocket, {
                    "type":       "broadcast_started",
                    "station_id": station_id,
                })
                await broadcast_station_list()
                print(f"Station active: {station_id} - {stations[station_id]['name']}")

            elif msg_type == "song_update":
                sid = msg.get("station_id")
                if sid and sid in stations and stations[sid]["broadcaster"] == websocket:
                    stations[sid]["song"] = msg.get("song", {})
                    await notify_listeners(sid, {
                        "type": "song_update",
                        "song": stations[sid]["song"],
                    })
                    await broadcast_station_list()

            elif msg_type == "tune_in":
                sid = msg.get("station_id")
                if sid and sid in stations:
                    stations[sid]["listeners"].add(websocket)
                    await send_json(websocket, {
                        "type": "tuned_in",
                        "station_id": sid,
                        "song": stations[sid]["song"],
                        "name": stations[sid]["name"],
                    })
                    await broadcast_station_list()
                else:
                    await send_json(websocket, {"error": "Station not found"})

            elif msg_type == "tune_out":
                sid = msg.get("station_id")
                if sid and sid in stations:
                    stations[sid]["listeners"].discard(websocket)
                    await send_json(websocket, {"type": "tuned_out"})
                    await broadcast_station_list()

            elif msg_type == "get_stations":
                await send_json(websocket, {
                    "type":     "stations_list",
                    "stations": stations_list(),
                })

    except websockets.exceptions.ConnectionClosed:
        pass

    finally:
        connections.discard(websocket)
        if is_broadcaster and station_id and station_id in stations:
            await notify_listeners(station_id, {
                "type":    "station_ended",
                "message": "The broadcaster has left.",
                "station_id": station_id,
            })
            del stations[station_id]
            print(f"Station ended: {station_id}")
        else:
            for station in stations.values():
                station["listeners"].discard(websocket)
        await broadcast_station_list()


async def main():
    print("ARMY Radio WebSocket server starting on port 8765...")
    async with websockets.serve(handler, "0.0.0.0", 8765, process_request=process_request):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
