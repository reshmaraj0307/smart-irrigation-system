from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime
from pymongo import MongoClient
import requests

# ✅ ADDED ML IMPORT
from sklearn.tree import DecisionTreeClassifier

# -----------------------------
# MONGODB SETUP
# -----------------------------
client = MongoClient("mongodb://localhost:27017/")
db = client["smart_irrigation"]
collection = db["sensor_data"]

# -----------------------------
# TELEGRAM SETUP
# -----------------------------
BOT_TOKEN = "Y8641521535:AAHSa9fkXfEUZfPC6xBmCLBFQCE6Rq1WPqM"
CHAT_ID = "2112874711"

def send_telegram(msg):
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        requests.post(url, data={"chat_id": CHAT_ID, "text": msg}, timeout=5)
    except Exception as e:
        print("Telegram error:", e)

# -----------------------------
# FLASK SETUP
# -----------------------------
app = Flask(__name__)
CORS(app)

# -----------------------------
# GLOBAL DATA
# -----------------------------
latest_data = {
    "moisture": 0,
    "tankLevel": 0,
    "rain": False,
    "temperature": 0,
    "humidity": 0,
    "rodentDetected": False
}

pump_status = "off"
auto_mode = True
threshold = 50

logs = []
last_rodent_state = False

# -----------------------------
# ✅ ADDED ML MODEL
# -----------------------------
model = None

def train_model():
    global model
    file = "sensor_data.xlsx"

    if not os.path.exists(file):
        return

    try:
        df = pd.read_excel(file)

        if not all(col in df.columns for col in ['moisture', 'rain', 'tankLevel', 'pump']):
            return

        df = df.dropna()
        df['rain'] = df['rain'].astype(int)

        X = df[['moisture', 'rain', 'tankLevel']]
        y = df['pump']

        model = DecisionTreeClassifier()
        model.fit(X, y)

    except Exception as e:
        print("Model error:", e)

# -----------------------------
# LOG FUNCTION
# -----------------------------
def add_log(message):
    global logs

    logs.insert(0, {
        "message": message,
        "createdAt": datetime.now().isoformat()
    })

    logs = logs[:10]

# -----------------------------
# LOGIN
# -----------------------------
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}

    return jsonify({
        "token": "demo-token",
        "user": {
            "username": data.get("username", ""),
            "role": "admin"
        }
    })

# -----------------------------
# SENSOR DATA FROM ESP32
# -----------------------------
@app.route('/api/sensors', methods=['POST'])
def sensors():
    global latest_data, pump_status, last_rodent_state, model

    data = request.get_json(silent=True) or {}

    latest_data = {
        "moisture": int(data.get("moisture", 0)),
        "tankLevel": int(data.get("waterLevel", 0)),
        "rain": bool(data.get("rain", False)),
        "temperature": float(data.get("temperature", 0)),
        "humidity": float(data.get("humidity", 0)),
        "rodentDetected": bool(data.get("rodentDetected", False))
    }

    pump_status = str(data.get("pump", "off")).lower()
    if pump_status not in ["on", "off"]:
        pump_status = "off"

    add_log("Pump Running" if pump_status == "on" else "Pump Stopped")

    if latest_data["rain"]:
        add_log("Rain Detected")

    rodent = latest_data["rodentDetected"]

    if rodent and not last_rodent_state:
        add_log("Rodent Detected - ALERT SENT")
        send_telegram("🚨 ALERT: Rodent detected in farm field!")

    last_rodent_state = rodent

    row = {
        "time": datetime.now(),
        "moisture": latest_data["moisture"],
        "tankLevel": latest_data["tankLevel"],
        "rain": latest_data["rain"],
        "pump": 1 if pump_status == "on" else 0,
        "rodentDetected": latest_data["rodentDetected"]
    }

    collection.insert_one(row)

    # ---------------- SAVE TO EXCEL ----------------
    file = "sensor_data.xlsx"
    df = pd.DataFrame([row])

    try:
        if os.path.exists(file):
            old = pd.read_excel(file)
            old = old.fillna(0)
            new = pd.concat([old, df], ignore_index=True)
            new.to_excel(file, index=False)
        else:
            df.to_excel(file, index=False)
    except Exception as e:
        print("Excel error:", e)

    # ---------------- ✅ ADDED ML PREDICTION ----------------
    predicted_pump = None

    if model is not None:
        try:
            pred = model.predict([[
                latest_data["moisture"],
                int(latest_data["rain"]),
                latest_data["tankLevel"]
            ]])
            predicted_pump = "on" if pred[0] == 1 else "off"
            add_log(f"AI Prediction: Pump {predicted_pump.upper()}")
        except Exception as e:
            print("Prediction error:", e)

    # Retrain after new data
    train_model()

    return jsonify({
        "message": "saved",
        "predictedPump": predicted_pump
    })

# -----------------------------
# DASHBOARD
# -----------------------------
@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    global model

    predicted_pump = None

    # ✅ ADDED PREDICTION HERE ALSO
    if model is not None:
        try:
            pred = model.predict([[
                latest_data["moisture"],
                int(latest_data["rain"]),
                latest_data["tankLevel"]
            ]])
            predicted_pump = "on" if pred[0] == 1 else "off"
        except:
            predicted_pump = None

    return jsonify({
        "latest": latest_data,
        "pump": {"status": pump_status},
        "predictedPump": predicted_pump,   # ✅ NEW FIELD
        "settings": {
            "autoMode": auto_mode,
            "threshold": threshold
        },
        "manualPump": pump_status,
        "logs": logs
    })

# -----------------------------
# MANUAL PUMP CONTROL
# -----------------------------
@app.route('/api/pump', methods=['POST'])
def pump():
    global pump_status

    data = request.get_json(force=True) or {}

    pump_status = str(data.get("status", "off")).lower()
    if pump_status not in ["on", "off"]:
        pump_status = "off"

    add_log(
        "Manual Pump ON from Website" if pump_status == "on"
        else "Manual Pump OFF from Website"
    )

    return jsonify({
        "pump": {"status": pump_status}
    })

# -----------------------------
# SETTINGS
# -----------------------------
@app.route('/api/settings', methods=['POST'])
def settings():
    global auto_mode, threshold

    data = request.json or {}

    auto_mode = bool(data.get("autoMode", True))
    threshold = int(data.get("threshold", 50))

    add_log("Auto Mode Enabled" if auto_mode else "Manual Mode Enabled")

    return jsonify({
        "settings": {
            "autoMode": auto_mode,
            "threshold": threshold
        }
    })

# -----------------------------
# CONTACT
# -----------------------------
@app.route('/api/contact', methods=['POST'])
def contact():
    return jsonify({"message": "sent"})

# -----------------------------
# RUN SERVER
# -----------------------------
if __name__ == '__main__':
    train_model()   # ✅ ADDED
    app.run(host="0.0.0.0", port=5000, debug=True)