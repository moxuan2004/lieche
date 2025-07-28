document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION --- //
    const CONTROLS_CONFIG = {
        train: { slider: document.getElementById('train-slider'), progress: document.getElementById('train-progress'), config: { min: 2, max: 8, weight: 0.4, step: 1 } },
        interval: { slider: document.getElementById('interval-slider'), progress: document.getElementById('interval-progress'), config: { min: 0.5, max: 3, weight: 0.3, inverse: true, step: 0.25 } },
        stopTime: { slider: document.getElementById('stop-time-slider'), progress: document.getElementById('stop-time-progress'), config: { min: 2, max: 15, weight: 0.15, step: 1 } },
        speed: { slider: document.getElementById('speed-slider'), progress: document.getElementById('speed-progress'), config: { min: 50, max: 120, weight: 0.15, inverse: true, step: 5 } }
    };

    const UI_ELEMENTS = {
        pressureIndicator: document.getElementById('total-pressure-indicator'),
        satisfactionEmoji: document.getElementById('satisfaction-emoji'),
        efficiencyStatus: document.getElementById('efficiency-status'),
        loadStatus: document.getElementById('load-status'),
        contributionChart: document.getElementById('contribution-chart'),
        station: document.getElementById('station'),
        platform: document.getElementById('platform-passengers'),
        trackContainer: document.querySelector('.track-area'),
        waitingCount: document.getElementById('platform-count')
    };

    // --- CLASSES --- //

    class Passenger {
        constructor(container) {
            this.element = document.createElement('div');
            this.element.className = 'passenger';
            container.appendChild(this.element);
        }

        setPosition(x, y) {
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
        }

        remove() {
            this.element.remove();
        }
    }

    class Train {
        constructor(id, container) {
            this.id = id;
            this.element = document.createElement('div');
            this.element.className = 'train';
            this.element.id = `train-${id}`;
            this.element.innerHTML = '<div class="door door-left"></div><div class="door door-right"></div>';
            container.appendChild(this.element);
            this.doors = this.element.querySelectorAll('.door');
            this.reset();
        }

        reset() {
            this.element.style.transition = 'none';
            this.element.style.left = '-200px'; // Start off-screen
            this.doors.forEach(d => d.classList.remove('open'));
            // Force reflow
            this.element.offsetHeight;
        }

        async arrive(speed) {
            return new Promise(resolve => {
                // Ensure starting position
                this.element.style.transition = 'none';
                this.element.style.left = '-200px';
                this.element.offsetHeight; // Force reflow
                
                // Speed is in km/h, convert to animation time (higher speed = shorter time)
                const baseTime = 2000; // Reduced base time for faster demo
                const speedFactor = Math.max(0.2, Math.min(1.5, 60 / speed)); // Adjusted speed factor
                const travelTime = Math.max(500, baseTime * speedFactor); // Minimum 0.5s
                
                this.element.style.transition = `left ${travelTime}ms ease-out`;
                this.element.style.left = 'calc(50% - 75px)'; // Center the train
                
                const onTransitionEnd = (e) => {
                    if (e.target === this.element && e.propertyName === 'left') {
                        this.element.removeEventListener('transitionend', onTransitionEnd);
                        console.log(`Train ${this.id} arrived at speed ${speed} km/h in ${travelTime}ms`);
                        resolve();
                    }
                };
                this.element.addEventListener('transitionend', onTransitionEnd);
                
                // Fallback timeout
                setTimeout(() => {
                    this.element.removeEventListener('transitionend', onTransitionEnd);
                    resolve();
                }, travelTime + 500);
            });
        }

        openDoors() {
            this.doors.forEach(d => d.classList.add('open'));
        }

        closeDoors() {
            this.doors.forEach(d => d.classList.remove('open'));
        }

        async depart(speed) {
            return new Promise(resolve => {
                // Speed is in km/h, convert to animation time (higher speed = shorter time)
                const baseTime = 2000; // Reduced base time for faster demo
                const speedFactor = Math.max(0.2, Math.min(1.5, 60 / speed)); // Adjusted speed factor
                const travelTime = Math.max(500, baseTime * speedFactor); // Minimum 0.5s
                
                this.element.style.transition = `left ${travelTime}ms ease-in`;
                this.element.style.left = 'calc(100% + 200px)';

                const onTransitionEnd = (e) => {
                    if (e.target === this.element && e.propertyName === 'left') {
                        this.element.removeEventListener('transitionend', onTransitionEnd);
                        console.log(`Train ${this.id} departed at speed ${speed} km/h in ${travelTime}ms`);
                        this.element.remove();
                        resolve();
                    }
                };
                this.element.addEventListener('transitionend', onTransitionEnd);
                
                // Fallback timeout
                setTimeout(() => {
                    this.element.removeEventListener('transitionend', onTransitionEnd);
                    this.element.remove();
                    resolve();
                }, travelTime + 500);
            });
        }
    }

    class Station {
        constructor(ui) {
            this.ui = ui;
            this.waitingPassengers = [];
            this.passengerCount = 0;
            this.basePassengerArrivalRate = 5; // Passengers per second at medium pressure
        }

        updateWaitingCount() {
            const count = Math.floor(this.passengerCount);
            if (this.ui.waitingCount) {
                this.ui.waitingCount.textContent = count;
            }
            
            // Find the platform area element
            const platformArea = document.querySelector('.platform-area');
            if (!platformArea) {
                console.log('Platform area not found');
                return;
            }
            
            const platformRect = platformArea.getBoundingClientRect();
            console.log(`Updating passenger count to ${count}, current visual count: ${this.waitingPassengers.length}`);

            // Add or remove passenger visuals
            while (this.waitingPassengers.length < count) {
                const p = new Passenger(platformArea);
                const x = Math.random() * Math.max(platformRect.width - 30, 50) + 15;
                const y = Math.random() * Math.max(platformRect.height - 30, 50) + 15;
                p.setPosition(x, y);
                p.element.classList.add('waiting');
                this.waitingPassengers.push(p);
            }
            while (this.waitingPassengers.length > count) {
                this.waitingPassengers.pop().remove();
            }
        }

        simulatePassengerFlow(pressure, deltaTime, controls) {
            // Store pressure for efficiency calculations
            this.lastPressure = pressure;
            
            // More realistic passenger arrival rate
            const baseRate = 3; // Increased base rate for more dramatic effect
            const pressureMultiplier = 1 + pressure * 2.5; // Higher multiplier
            const arrivalRate = baseRate * pressureMultiplier;
            
            // Add some randomness to make it more natural
            const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
            this.passengerCount += arrivalRate * deltaTime * randomFactor;
            
            // Natural passenger departure when system is efficient
            if (pressure < 0.4) {
                const departureRate = (0.4 - pressure) * 3; // More efficient = more natural departures
                this.passengerCount -= departureRate * deltaTime;
            }
            
            // Ensure minimum passenger count for visibility
            if (this.passengerCount < 3) {
                this.passengerCount = 3;
            }
            
            // No maximum limit - allow unlimited growth to show the impact of poor settings
            // This demonstrates the importance of good metro management
            
            this.updateWaitingCount();
        }

        boardTrain(train, count) {
            const numToBoard = Math.min(this.passengerCount, count);
            this.passengerCount -= numToBoard;
            
            // Additional passenger reduction based on system efficiency
            // Good settings help clear more passengers than just those boarding
            const efficiencyBonus = Math.max(0, (0.7 - this.lastPressure) * 2); // 0-0.4 range
            const bonusReduction = numToBoard * efficiencyBonus;
            this.passengerCount = Math.max(0, this.passengerCount - bonusReduction);
            
            this.updateWaitingCount();
            return numToBoard;
        }

        alightTrain(count) {
            this.passengerCount += count;
            this.updateWaitingCount();
        }

        async animateAlighting(count) {
            // Create temporary alighting passengers
            const platformArea = document.querySelector('.platform-area');
            if (!platformArea || count <= 0) return;
            
            const alightingPassengers = [];
            for (let i = 0; i < Math.min(count, 8); i++) {
                const passenger = document.createElement('div');
                passenger.className = 'passenger alighting';
                passenger.style.left = '50%';
                passenger.style.top = '80%';
                passenger.style.transform = 'translate(-50%, -50%)';
                platformArea.appendChild(passenger);
                alightingPassengers.push(passenger);
                
                // Animate to random position
                setTimeout(() => {
                    const x = Math.random() * 80 + 10;
                    const y = Math.random() * 60 + 20;
                    passenger.style.left = `${x}%`;
                    passenger.style.top = `${y}%`;
                }, i * 100);
            }
            
            // Remove after animation
            setTimeout(() => {
                alightingPassengers.forEach(p => p.remove());
            }, 1000);
            
            return new Promise(resolve => setTimeout(resolve, 400));
        }

        async animateBoarding(count) {
            if (count <= 0) return;
            
            // Animate some waiting passengers moving to train
            const passengersToAnimate = Math.min(this.waitingPassengers.length, Math.min(count, 6));
            const animatingPassengers = this.waitingPassengers.slice(0, passengersToAnimate);
            
            animatingPassengers.forEach((passenger, index) => {
                setTimeout(() => {
                    passenger.element.classList.add('boarding');
                    passenger.element.style.left = '50%';
                    passenger.element.style.top = '80%';
                    passenger.element.style.transform = 'translate(-50%, -50%)';
                    
                    setTimeout(() => {
                        passenger.remove();
                        const idx = this.waitingPassengers.indexOf(passenger);
                        if (idx > -1) this.waitingPassengers.splice(idx, 1);
                    }, 400);
                }, index * 150);
            });
            
            return new Promise(resolve => setTimeout(resolve, 400));
        }
    }

    class Simulation {
        constructor(controls, ui) {
            this.controls = controls;
            this.ui = ui;
            this.station = new Station(ui);
            this.trainCounter = 0;
            this.isRunning = true;
            this.lastUpdateTime = performance.now();
            this.nextTrainTime = 0;
            this.pressure = 0.5;
            this.isDispatchingTrain = false; // Prevent concurrent train dispatching
        }

        init() {
            for (const key in this.controls) {
                this.controls[key].slider.addEventListener('input', () => this.updateDashboard());
            }
            this.updateDashboard();
            this.nextTrainTime = 5; // First train arrives in 5 seconds
            requestAnimationFrame(this.gameLoop.bind(this));
        }

        gameLoop(timestamp) {
            if (!this.isRunning) return;

            const deltaTime = (timestamp - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = timestamp;

            // Only update passenger count when no train is being dispatched
            // This prevents passenger growth during train operations
            if (!this.isDispatchingTrain) {
                this.station.simulatePassengerFlow(this.pressure, deltaTime, this.controls);
            }

            // Update dashboard
            this.updateDashboard();

            // Dispatch trains
            if (this.isRunning && !this.isDispatchingTrain) {
                this.nextTrainTime -= deltaTime;
                if (this.nextTrainTime <= 0) {
                    this.isDispatchingTrain = true;
                    this.dispatchTrain().finally(() => {
                        this.isDispatchingTrain = false;
                    });
                    this.resetTrainTimer();
                }
            }

            requestAnimationFrame(this.gameLoop.bind(this));
        }

        async dispatchTrain() {
            try {
                this.trainCounter++;
                const trackArea = document.querySelector('.track-area');
                if (!trackArea) {
                    console.error('Track area not found');
                    return;
                }
                
                const train = new Train(this.trainCounter, trackArea);
                const speed = parseFloat(this.controls.speed.slider.value);
                const stopTime = parseFloat(this.controls.stopTime.slider.value);

                console.log(`Train ${this.trainCounter} arriving at speed ${speed}`);
                await train.arrive(speed);
                
                console.log(`Train ${this.trainCounter} opening doors`);
                train.openDoors();

                // Simulate passenger exchange with animations
                const capacity = parseFloat(this.controls.train.slider.value) * 20;
                const numAlighting = Math.floor(Math.random() * capacity * 0.4);
                
                // Animate passengers alighting
                await this.station.animateAlighting(numAlighting);
                this.station.alightTrain(numAlighting);
                
                // Wait a moment for alighting to complete
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Animate passengers boarding
                const spaceOnTrain = capacity - (capacity * 0.6) + numAlighting;
                const actualBoarding = this.station.boardTrain(train, spaceOnTrain);
                await this.station.animateBoarding(actualBoarding);

                console.log(`Train ${this.trainCounter} stopping for ${stopTime * 0.1} seconds`);
                await new Promise(resolve => setTimeout(resolve, stopTime * 100)); // Convert to 1/10th scale

                console.log(`Train ${this.trainCounter} closing doors`);
                train.closeDoors();
                await new Promise(resolve => setTimeout(resolve, 200));

                console.log(`Train ${this.trainCounter} departing`);
                await train.depart(speed);
                
                console.log(`Train ${this.trainCounter} completed journey`);
            } catch (error) {
                console.error(`Error in train ${this.trainCounter} dispatch:`, error);
            }
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
            this.ui.pressureIndicator.style.left = `${(1 - weightedAverageRelief) * 100}%`;
            if (weightedAverageRelief > 0.75) this.ui.satisfactionEmoji.textContent = '😄';
            else if (weightedAverageRelief > 0.5) this.ui.satisfactionEmoji.textContent = '😊';
            else if (weightedAverageRelief > 0.25) this.ui.satisfactionEmoji.textContent = '😐';
            else this.ui.satisfactionEmoji.textContent = '😟';

            this.ui.efficiencyStatus.textContent = weightedAverageRelief > 0.6 ? '显著提升' : '提升中';
            this.ui.loadStatus.textContent = this.pressure < 0.5 ? '平稳可控' : '负荷较高';
            this.ui.loadStatus.style.backgroundColor = this.pressure < 0.5 ? 'var(--color-success)' : 'var(--color-warning)';

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
    const simulation = new Simulation(CONTROLS_CONFIG, UI_ELEMENTS);
    simulation.init();
});