from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Temporary memory storage
latest_data = {
    "moisture": 0,
    "tankLevel": 0,
    "rain": False,
    "temperature": 0,
    "humidity": 0
}

pump_status = "off"
auto_mode = True
threshold = 50

# LOGIN
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json

    return jsonify({
        "token": "demo-token",
        "user": {
            "username": data["username"],
            "role": "admin"
        }
    })

# ESP32 SENSOR DATA
@app.route('/api/sensors', methods=['POST'])
def sensors():

    global latest_data

    data = request.json
    latest_data = data

    # Save Excel
    file = "sensor_data.xlsx"

    row = {
        "time": datetime.now(),
        "moisture": data.get("moisture"),
        "tankLevel": data.get("waterLevel"),
        "rain": data.get("rain")
    }

    df = pd.DataFrame([row])

    if os.path.exists(file):
        old = pd.read_excel(file)
        new = pd.concat([old, df], ignore_index=True)
        new.to_excel(file, index=False)
    else:
        df.to_excel(file, index=False)

    return jsonify({"message": "saved"})

# DASHBOARD
@app.route('/api/dashboard')
def dashboard():

    return jsonify({
        "latest": latest_data,
        "pump": {"status": pump_status},
        "settings": {
            "autoMode": auto_mode,
            "threshold": threshold
        },
        "logs": []
    })

# PUMP CONTROL
@app.route('/api/pump', methods=['POST'])
def pump():
    global pump_status

    data = request.json
    pump_status = data["status"]

    return jsonify({
        "pump": {
            "status": pump_status
        }
    })

# SETTINGS
@app.route('/api/settings', methods=['POST'])
def settings():
    global auto_mode, threshold

    data = request.json
    auto_mode = data["autoMode"]
    threshold = data["threshold"]

    return jsonify({
        "settings": {
            "autoMode": auto_mode,
            "threshold": threshold
        }
    })

# CONTACT
@app.route('/api/contact', methods=['POST'])
def contact():
    return jsonify({"message": "sent"})


if __name__ == '__main__':
    app.run(debug=True)