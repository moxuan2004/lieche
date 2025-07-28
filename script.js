document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION --- //
    const CONTROLS_CONFIG = {
        train: { slider: document.getElementById('train-slider'), progress: document.getElementById('train-progress'), config: { min: 2, max: 8, weight: 0.4, step: 1 } },
        interval: { slider: document.getElementById('interval-slider'), progress: document.getElementById('interval-progress'), config: { min: 0.5, max: 3, weight: 0.3, inverse: true, step: 0.25 } },
        stopTime: { slider: document.getElementById('stop-time-slider'), progress: document.getElementById('stop-time-progress'), config: { min: 2, max: 15, weight: 0.15, inverse: false, step: 1 } },
        speed: { slider: document.getElementById('speed-slider'), progress: document.getElementById('speed-progress'), config: { min: 50, max: 120, weight: 0.15, step: 5, inverse: true } }
    };

    const UI_ELEMENTS = {
        pressureIndicator: document.getElementById('total-pressure-indicator'),
        satisfactionEmoji: document.getElementById('satisfaction-emoji'),
        efficiencyStatus: document.getElementById('efficiency-status'),
        loadStatus: document.getElementById('load-status'),
        contributionChart: document.getElementById('contribution-chart'),
        lineContainer: document.getElementById('line-container')
    };

    const LINE_CONFIG = {
        stations: 5,
        stationNames: ['中心站', '博览中心', '世纪城', '金融城', '孵化园']
    };

    // --- CLASSES --- //

    class Train {
        constructor(id, container) {
            this.id = id;
            this.element = document.createElement('div');
            this.element.className = 'train';
            this.element.id = `train-${id}`;
            this.element.textContent = `T${id}`;
            container.appendChild(this.element);
            this.position = -50; // Start off-screen
            this.element.style.left = `${this.position}px`;
        }

        moveTo(position, duration) {
            return new Promise(resolve => {
                this.element.style.transition = `left ${duration}s linear`;
                this.element.style.left = `${position}px`;
                setTimeout(resolve, duration * 1000);
            });
        }

        remove() {
            this.element.remove();
        }
    }

    class MetroLine {
        constructor(ui, lineConfig) {
            this.ui = ui;
            this.config = lineConfig;
            this.stations = [];
            this.trains = new Map();
            this.trainCounter = 0;
            this.lineLength = this.ui.lineContainer.offsetWidth;
            this.isFirstStationOccupied = false;

            this.setupLine();
        }

        setupLine() {
            this.ui.lineContainer.innerHTML = ''; // Clear previous setup
            const track = document.createElement('div');
            track.className = 'line-track';
            this.ui.lineContainer.appendChild(track);

            for (let i = 0; i < this.config.stations; i++) {
                const stationElement = document.createElement('div');
                stationElement.className = 'station-node';
                
                const stationName = document.createElement('div');
                stationName.className = 'station-name';
                stationName.textContent = this.config.stationNames[i] || `Station ${i + 1}`;
                stationElement.appendChild(stationName);

                this.ui.lineContainer.appendChild(stationElement);
                this.stations.push({ element: stationElement, load: 0, isOccupied: false });
            }
        }

        simulatePassengerFlow(pressure, deltaTime) {
            const baseArrival = 5; // passengers per second per station
            const pressureFactor = 1 + pressure * 2;
            const arrivals = baseArrival * pressureFactor * deltaTime;

            this.stations.forEach(station => {
                station.load += arrivals * (0.8 + Math.random() * 0.4); // Add some randomness
                this.updateStationAppearance(station);
            });
        }

        updateStationAppearance(station) {
            const load = station.load;
            let color = 'hsl(210, 50%, 80%)'; // Default light blue
            if (load > 100) color = 'hsl(60, 80%, 60%)'; // Yellow
            if (load > 250) color = 'hsl(30, 90%, 60%)'; // Orange
            if (load > 500) color = 'hsl(0, 90%, 60%)'; // Red
            station.element.style.backgroundColor = color;
        }

        async runTrain(controls) {
            this.trainCounter++;
            const trainId = this.trainCounter;
            const train = new Train(trainId, this.ui.lineContainer);
            this.trains.set(trainId, train);

            const speed = parseFloat(controls.speed.slider.value);
            const stopTimeValue = parseFloat(controls.stopTime.slider.value);
            const capacity = 250; // Fixed capacity per train

            const stationPositions = this.stations.map(s => s.element.offsetLeft + s.element.offsetWidth / 2);

            for (let i = 0; i < stationPositions.length; i++) {
                const station = this.stations[i];
                const nextStation = this.stations[i + 1];

                // Block section logic
                while (station.isOccupied || (nextStation && nextStation.isOccupied)) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Wait if the current or next station is occupied
                }
                station.isOccupied = true;
                if (i > 0) {
                    this.stations[i - 1].isOccupied = false; // Free the previous station
                }

                const position = stationPositions[i];
                const distance = position - train.position;
                const travelTime = (distance / speed) * 20; // Adjust factor for visual speed

                await train.moveTo(position, travelTime);
                train.position = position;

                // Simulate passenger exchange based on stop time
                const exchangeRate = 20; // passengers per second
                const maxExchange = exchangeRate * stopTimeValue;
                const boarded = Math.min(station.load, capacity, maxExchange);
                station.load -= boarded;
                this.updateStationAppearance(station);

                await new Promise(resolve => setTimeout(resolve, stopTimeValue * 100));
            }

            // Free the last station
            if (this.stations.length > 0) {
                this.stations[this.stations.length - 1].isOccupied = false;
            }

            // Final departure off-screen
            const finalPosition = this.lineLength + 100;
            const finalDistance = finalPosition - train.position;
            const finalTravelTime = (finalDistance / speed) * 20;
            await train.moveTo(finalPosition, finalTravelTime);

            this.trains.delete(trainId);
            train.remove();
        }
    }

    class Simulation {
        constructor(controls, ui, lineConfig) {
            this.controls = controls;
            this.ui = ui;
            this.metroLine = new MetroLine(ui, lineConfig);
            this.isRunning = true;
            this.lastUpdateTime = performance.now();
            this.nextTrainTime = 0;
            this.pressure = 0.5;
        }

        init() {
            for (const key in this.controls) {
                this.controls[key].slider.addEventListener('input', () => this.updateDashboard());
            }
            this.setInitialDifficulty();
            this.updateDashboard();
            this.nextTrainTime = 5; // First train arrives in 5 seconds
            requestAnimationFrame(this.gameLoop.bind(this));
        }

        setInitialDifficulty() {
            this.controls.train.slider.value = this.controls.train.config.min;
            this.controls.interval.slider.value = this.controls.interval.config.max;
            this.controls.stopTime.slider.value = this.controls.stopTime.config.min;
            this.controls.speed.slider.value = this.controls.speed.config.min;
        }

        gameLoop(timestamp) {
            if (!this.isRunning) return;

            const deltaTime = (timestamp - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = timestamp;

            // Only update passenger count when no train is being dispatched
            this.metroLine.simulatePassengerFlow(this.pressure, deltaTime);

            // Update dashboard
            this.updateDashboard();

            // Dispatch trains
            this.nextTrainTime -= deltaTime;
            if (this.nextTrainTime <= 0 && this.metroLine.trains.size < this.controls.train.slider.value && !this.metroLine.stations[0].isOccupied) {
                this.metroLine.runTrain(this.controls);
                this.resetTrainTimer();
            }

            requestAnimationFrame(this.gameLoop.bind(this));
        }



        resetTrainTimer() {
            const interval = parseFloat(this.controls.interval.slider.value);
            this.nextTrainTime = interval * 2; // Convert to very fast demo timing for high frequency
        }

        updateDashboard() {
            const state = {};
            let totalRelief = 0;
            let totalWeight = 0;

            for (const key in this.controls) {
                const { slider, progress, config } = this.controls[key];
                const value = parseFloat(slider.value);
                const relief = this.calculateRelief(value, config.min, config.max, config.inverse);
                state[key] = { relief, weight: config.weight };
                progress.style.width = `${relief * 100}%`;
                totalRelief += relief * config.weight;
                totalWeight += config.weight;
            }

            const targetTrainCount = parseInt(this.controls.train.slider.value, 10);
            while (this.metroLine.trains.size > targetTrainCount) {
                const lastTrainId = Math.max(...this.metroLine.trains.keys());
                const trainToRemove = this.metroLine.trains.get(lastTrainId);
                if (trainToRemove) {
                    trainToRemove.remove();
                    this.metroLine.trains.delete(lastTrainId);
                } else {
                    break;
                }
            }

            const weightedAverageRelief = totalWeight > 0 ? totalRelief / totalWeight : 0;
            this.pressure = 1 - weightedAverageRelief;
            this.updateSummaryUI(weightedAverageRelief, state);
        }

        calculateRelief(value, min, max, inverse = false) {
            const range = max - min;
            if (range === 0) return 0.5;
            const percentage = (value - min) / range;
            return inverse ? 1 - percentage : percentage;
        }

        updateSummaryUI(weightedAverageRelief, state) {
            const pressurePercentage = (1 - weightedAverageRelief) * 100;
            this.ui.pressureIndicator.style.left = `${pressurePercentage}%`;
            console.log(`Updating pressure indicator left to: ${pressurePercentage}%`); // Debugging log

            if (weightedAverageRelief > 0.75) this.ui.satisfactionEmoji.textContent = '😄';
            else if (weightedAverageRelief > 0.5) this.ui.satisfactionEmoji.textContent = '😊';
            else if (weightedAverageRelief > 0.25) this.ui.satisfactionEmoji.textContent = '😐';
            else this.ui.satisfactionEmoji.textContent = '😟';

            this.ui.efficiencyStatus.textContent = weightedAverageRelief > 0.6 ? '显著提升' : '提升中';
            this.ui.loadStatus.textContent = this.pressure < 0.5 ? '平稳可控' : '负荷较高';
            this.ui.loadStatus.style.backgroundColor = this.pressure < 0.5 ? 'var(--color-success)' : 'var(--color-danger)'; // Use danger for high load

            this.updateContributionChart(state);
        }

        updateContributionChart(state) {
            this.ui.contributionChart.innerHTML = '';
            const totalContribution = Object.values(state).reduce((sum, { relief, weight }) => sum + relief * weight, 0);
            if (totalContribution > 0) {
                for (const key in state) {
                    const { relief, weight } = state[key];
                    const contribution = (relief * weight) / totalContribution;
                    const bar = document.createElement('div');
                    bar.className = 'contribution-bar';
                    bar.id = `${key}-contrib`;
                    bar.style.width = `${contribution * 100}%`;
                    this.ui.contributionChart.appendChild(bar);
                }
            }
        }
    }

    // --- INITIALIZATION --- //
    const simulation = new Simulation(CONTROLS_CONFIG, UI_ELEMENTS, LINE_CONFIG);
    simulation.init();
});