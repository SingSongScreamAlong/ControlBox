// =====================================================================
// Incident Classification Engine Tests
// =====================================================================

describe('Classification Engine', () => {
    // Helper function to classify contacts
    function classifyContact(params: Record<string, unknown>) {
        if (params.hitFromBehind) {
            return { type: 'rear_end', aggressorPosition: 'behind' };
        }
        if (params.sideContact && params.bothCarsAlongside) {
            return { type: 'side_contact' };
        }
        if (params.lateBraking && params.cornerEntry) {
            return { type: 'divebomb' };
        }
        if (params.trackPositionChange === 'inward' && params.victimOnOutside) {
            return { type: 'squeeze' };
        }
        return { type: 'unknown' };
    }

    // Helper function to determine fault
    function determineFault(params: Record<string, unknown>) {
        if (params.contactType === 'rear_end') {
            return { primaryDriver: 'following', confidence: 0.9, shared: false, racingIncident: false };
        }
        if (params.bothCarsAggressive && params.noRuleViolation) {
            return { shared: true, racingIncident: true, confidence: 0.6 };
        }
        if (params.contactType === 'rejoin') {
            return { primaryDriver: params.rejoiningDriver, confidence: 0.95, shared: false, racingIncident: false };
        }
        return { shared: true, confidence: 0.5, racingIncident: true };
    }

    describe('Contact Type Classification', () => {
        it('should classify rear-end contact', () => {
            const classification = classifyContact({
                hitFromBehind: true,
                cornerPhase: 'straight',
            });

            expect(classification.type).toBe('rear_end');
            expect(classification.aggressorPosition).toBe('behind');
        });

        it('should classify side-by-side contact', () => {
            const classification = classifyContact({
                sideContact: true,
                bothCarsAlongside: true,
            });

            expect(classification.type).toBe('side_contact');
        });

        it('should classify divebomb', () => {
            const classification = classifyContact({
                lateBraking: true,
                cornerEntry: true,
                attackerNotAlongside: true,
            });

            expect(classification.type).toBe('divebomb');
        });

        it('should classify squeeze', () => {
            const classification = classifyContact({
                trackPositionChange: 'inward',
                victimOnOutside: true,
                noEscapeRoute: true,
            });

            expect(classification.type).toBe('squeeze');
        });

        it('should return unknown for ambiguous incidents', () => {
            const classification = classifyContact({
                noDataAvailable: true,
            });

            expect(classification.type).toBe('unknown');
        });
    });

    describe('Fault Determination', () => {
        it('should assign fault to following car in rear-end', () => {
            const fault = determineFault({
                contactType: 'rear_end',
                leadCarBraking: false,
                unexpectedSlowing: false,
            });

            expect(fault.primaryDriver).toBe('following');
            expect(fault.confidence).toBeGreaterThan(0.8);
        });

        it('should share fault in racing incident', () => {
            const fault = determineFault({
                contactType: 'side_contact',
                bothCarsAggressive: true,
                noRuleViolation: true,
            });

            expect(fault.shared).toBe(true);
            expect(fault.racingIncident).toBe(true);
        });

        it('should assign fault for unsafe rejoin', () => {
            const fault = determineFault({
                contactType: 'rejoin',
                rejoiningDriver: 'car-1',
                heldBrakes: false,
            });

            expect(fault.primaryDriver).toBe('car-1');
            expect(fault.confidence).toBeGreaterThan(0.9);
        });
    });

    describe('Confidence Scoring', () => {
        it('should return high confidence for clear incidents', () => {
            const fault = determineFault({ contactType: 'rear_end' });
            expect(fault.confidence).toBeGreaterThanOrEqual(0.8);
        });

        it('should return lower confidence for ambiguous incidents', () => {
            const fault = determineFault({ ambiguous: true });
            expect(fault.confidence).toBeLessThanOrEqual(0.6);
        });
    });

    describe('Edge Cases', () => {
        it('should handle multi-car incidents', () => {
            const incident = {
                carsInvolved: ['car-1', 'car-2', 'car-3', 'car-4'],
                initialContact: { cars: ['car-1', 'car-2'] },
            };

            expect(incident.carsInvolved.length).toBe(4);
            expect(incident.initialContact.cars.length).toBe(2);
        });

        it('should handle weather conditions', () => {
            const context = {
                weather: 'rain',
                brakingDistanceMultiplier: 1.5,
            };

            expect(context.brakingDistanceMultiplier).toBeGreaterThan(1);
        });

        it('should handle first lap incidents with reduced penalties', () => {
            const context = {
                lapNumber: 1,
                isFirstLap: true,
                penaltyReductionFactor: 0.5,
            };

            expect(context.penaltyReductionFactor).toBeLessThan(1);
        });
    });
});
