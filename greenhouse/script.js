const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const TABLE_NAME = "sensor_data";


// ===============================
// SUPABASE CLIENT
// ===============================

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ===============================
// DOM ELEMENTS
// ===============================

const temperatureElement =
    document.getElementById("temperature");

const humidityElement =
    document.getElementById("humidity");

const connectionText =
    document.getElementById("connectionText");

const greenhouseStatus =
    document.getElementById("greenhouseStatus");

const greenhouseStatusDot =
    document.getElementById("greenhouseStatusDot");

const statusDescription =
    document.getElementById("statusDescription");

const fanStatus =
    document.getElementById("fanStatus");

const fanStatusDot =
    document.getElementById("fanStatusDot");

const doorStatus =
    document.getElementById("doorStatus");

const doorStatusDot =
    document.getElementById("doorStatusDot");

const lastUpdate =
    document.getElementById("lastUpdate");


// ===============================
// CHART DATA
// ===============================

let temperatureChart;
let humidityChart;


// ===============================
// GET SENSOR DATA
// ===============================

async function getSensorData() {

    try {

        connectionText.textContent = "Connecting...";

        const { data, error } = await supabaseClient
            .from(TABLE_NAME)
            .select("*")
            .order("created_at", {
                ascending: false
            })
            .limit(20);


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            connectionText.textContent = "No data";

            greenhouseStatus.textContent =
                "Waiting for data";

            statusDescription.textContent =
                "The ESP32 has not sent any readings yet.";

            return;
        }


        // ===============================
        // LATEST READING
        // ===============================

        const latest = data[0];

        const temperature =
            Number(latest.temperature);

        const humidity =
            Number(latest.humidity);


        // ===============================
        // UPDATE DASHBOARD
        // ===============================

        temperatureElement.textContent =
            temperature.toFixed(1);

        humidityElement.textContent =
            humidity.toFixed(1);


        // ===============================
        // CONNECTION
        // ===============================

        connectionText.textContent =
            "Connected";


        // ===============================
        // LAST UPDATE
        // ===============================

        if (latest.created_at) {

            const date =
                new Date(latest.created_at);

            lastUpdate.textContent =
                date.toLocaleString();

        }


        // ===============================
        // GREENHOUSE STATUS
        // ===============================

        updateGreenhouseStatus(
            temperature,
            humidity
        );


        // ===============================
        // DEVICE STATUS
        // ===============================

        updateDeviceStatus(
            temperature,
            humidity
        );


        // ===============================
        // CHARTS
        // ===============================

        updateCharts(data);


    } catch (error) {

        console.error(
            "Supabase error:",
            error
        );

        connectionText.textContent =
            "Connection error";

        greenhouseStatus.textContent =
            "Offline";

        statusDescription.textContent =
            "Unable to retrieve greenhouse data.";

    }

}


// ===============================
// GREENHOUSE STATUS
// ===============================

function updateGreenhouseStatus(
    temperature,
    humidity
) {

    /*
        These values are only example
        greenhouse limits.

        We can change them later
        according to the actual crops.
    */

    const temperatureGood =
        temperature >= 18 &&
        temperature <= 30;

    const humidityGood =
        humidity >= 40 &&
        humidity <= 80;


    if (temperatureGood && humidityGood) {

        greenhouseStatus.textContent =
            "Good";

        statusDescription.textContent =
            "Temperature and humidity are within the normal range.";

        greenhouseStatusDot.style.background =
            "#2f7d46";

    }

    else {

        greenhouseStatus.textContent =
            "Needs Attention";

        greenhouseStatusDot.style.background =
            "#e68a35";


        if (!temperatureGood) {

            statusDescription.textContent =
                "Temperature is outside the recommended range.";

        }

        else if (!humidityGood) {

            statusDescription.textContent =
                "Humidity is outside the recommended range.";

        }

    }

}


// ===============================
// FAN + DOOR STATUS
// ===============================

function updateDeviceStatus(
    temperature,
    humidity
) {

    /*
        Temporary automatic rules.

        FAN:
        Turn ON if temperature > 30°C
        OR humidity > 80%

        DOOR:
        Open if temperature > 30°C
        OR humidity > 80%
    */

    const ventilationNeeded =
        temperature > 30 ||
        humidity > 80;


    if (ventilationNeeded) {

        // FAN ON

        fanStatus.textContent =
            "ON";

        fanStatusDot.style.background =
            "#2f7d46";


        // DOOR OPEN

        doorStatus.textContent =
            "OPEN";

        doorStatusDot.style.background =
            "#2f7d46";

    }

    else {

        // FAN OFF

        fanStatus.textContent =
            "OFF";

        fanStatusDot.style.background =
            "#9ca79e";


        // DOOR CLOSED

        doorStatus.textContent =
            "CLOSED";

        doorStatusDot.style.background =
            "#9ca79e";

    }

}


// ===============================
// CREATE / UPDATE CHARTS
// ===============================

function updateCharts(data) {

    /*
        Supabase returns newest first.
        Reverse it so the chart goes
        from oldest → newest.
    */

    const readings =
        [...data].reverse();


    const labels =
        readings.map((reading) => {

            const date =
                new Date(reading.created_at);

            return date.toLocaleTimeString();

        });


    const temperatures =
        readings.map((reading) =>
            Number(reading.temperature)
        );


    const humidities =
        readings.map((reading) =>
            Number(reading.humidity)
        );


    // ===============================
    // TEMPERATURE CHART
    // ===============================

    const temperatureCanvas =
        document.getElementById(
            "temperatureChart"
        );


    if (temperatureChart) {

        temperatureChart.destroy();

    }


    temperatureChart =
        new Chart(
            temperatureCanvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label: "Temperature °C",

                            data: temperatures,

                            borderWidth: 3,

                            tension: 0.4,

                            fill: true,

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {
                            display: false
                        }

                    },

                    scales: {

                        y: {

                            beginAtZero: false

                        }

                    }

                }

            }
        );


    // ===============================
    // HUMIDITY CHART
    // ===============================

    const humidityCanvas =
        document.getElementById(
            "humidityChart"
        );


    if (humidityChart) {

        humidityChart.destroy();

    }


    humidityChart =
        new Chart(
            humidityCanvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label: "Humidity %",

                            data: humidities,

                            borderWidth: 3,

                            tension: 0.4,

                            fill: true,

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {
                            display: false
                        }

                    },

                    scales: {

                        y: {

                            beginAtZero: false

                        }

                    }

                }

            }
        );

}


// ===============================
// AUTO REFRESH
// ===============================

getSensorData();


setInterval(
    getSensorData,
    5000
);