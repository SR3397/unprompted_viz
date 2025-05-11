"""
Simulation logic for unprompted message frequency and period-specific binomial distributions.
"""
import random
import math
import json
from collections import defaultdict
import sys

print("[Python Script DBG] simulation.py started.", file=sys.stderr)

DEFAULT_CONFIG = {
    "UNPROMPTED_CHANCE_BUILD_AMOUNT": 0.2,
    "UNPROMPTED_ROLL_INTERVAL_SECONDS": 300,
    "UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS": 300,
    "unpromptedTimePeriods_multipliers": {
        "Night": 1.0,
        "Morning": 6.0,
        "Afternoon": 8.4,
        "Evening": 10.5,
    },
    "time_period_definitions": { # hour_start (inclusive), hour_end (inclusive)
        "Night": (0, 5),    # 6 hours
        "Morning": (6, 11),   # 6 hours
        "Afternoon": (12, 17), # 6 hours
        "Evening": (18, 23),  # 6 hours
    }
}

def factorial(n):
    if n < 0: raise ValueError("Factorial is not defined for negative numbers")
    res = 1
    for i in range(1, n + 1): res *= i
    return res

def combinations(n, k):
    if k < 0 or k > n: return 0
    if k == 0 or k == n: return 1
    if k > n // 2: k = n - k
    return factorial(n) // (factorial(k) * factorial(n - k))

def binomial_probability(n, k, p):
    if p < 0 or p > 1: raise ValueError("Probability p must be between 0 and 1")
    if n < 0: raise ValueError("Number of trials n cannot be negative")
    q = 1.0 - p
    try:
        return combinations(n, k) * (p ** k) * (q ** (n - k))
    except OverflowError:
        print(f"[Python Script DBG] OverflowError in binomial_probability(n={n}, k={k}, p={p}).", file=sys.stderr)
        return 0

def get_current_time_period(current_hour_of_day, time_period_definitions):
    for period_name, (start_hour, end_hour) in time_period_definitions.items():
        if start_hour <= current_hour_of_day <= end_hour:
            return period_name
    return "Night"

def run_simulation_for_duration(config, simulation_total_seconds):
    chance_build_amount = config.get("UNPROMPTED_CHANCE_BUILD_AMOUNT", DEFAULT_CONFIG["UNPROMPTED_CHANCE_BUILD_AMOUNT"])
    roll_interval = config.get("UNPROMPTED_ROLL_INTERVAL_SECONDS", DEFAULT_CONFIG["UNPROMPTED_ROLL_INTERVAL_SECONDS"])
    chance_build_interval = config.get("UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS", DEFAULT_CONFIG["UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS"])
    time_multipliers = config.get("unpromptedTimePeriods_multipliers", DEFAULT_CONFIG["unpromptedTimePeriods_multipliers"])
    period_defs = config.get("time_period_definitions", DEFAULT_CONFIG["time_period_definitions"])
    if chance_build_interval <= 0: chance_build_interval = 1
    if roll_interval <= 0: roll_interval = 1
    current_chance = 0.0
    sim_time = 0
    next_build_event_time = 0
    next_roll_event_time = 0
    message_timestamps = []
    while sim_time < simulation_total_seconds:
        event_time = 0
        event_type = None
        if next_build_event_time == next_roll_event_time:
            event_time = next_build_event_time
            event_type = "both"
            next_build_event_time += chance_build_interval
            next_roll_event_time += roll_interval
        elif next_build_event_time < next_roll_event_time:
            event_time = next_build_event_time
            event_type = "build"
            next_build_event_time += chance_build_interval
        else:
            event_time = next_roll_event_time
            event_type = "roll"
            next_roll_event_time += roll_interval
        sim_time = event_time
        if sim_time >= simulation_total_seconds: break
        hour_of_day = (sim_time // 3600) % 24
        if event_type == "build" or event_type == "both":
            active_period = get_current_time_period(hour_of_day, period_defs)
            multiplier = time_multipliers.get(active_period, 1.0)
            current_chance += chance_build_amount * multiplier
            current_chance = min(current_chance, 100.0)
        if event_type == "roll" or event_type == "both":
            if random.uniform(0, 100) < current_chance:
                message_timestamps.append(sim_time)
                current_chance = 0.0
    return message_timestamps

def analyze_timestamps(message_timestamps, total_simulation_seconds, num_days_simulated, bins_per_24h=24):
    if not message_timestamps or num_days_simulated == 0 or bins_per_24h == 0:
        bin_labels = []
        if bins_per_24h > 0:
            seconds_per_bin_calc = (24 * 3600) // bins_per_24h
            for i in range(bins_per_24h):
                start_s_total = i * seconds_per_bin_calc; start_h = start_s_total // 3600; start_m = (start_s_total % 3600) // 60
                end_s_total = (i + 1) * seconds_per_bin_calc - 1; end_h = end_s_total // 3600; end_m = (end_s_total % 3600) // 60
                bin_labels.append(f"{start_h:02d}:{start_m:02d}-{end_h:02d}:{end_m:02d}")
        return [{"time_bin": bin_labels[i] if i < len(bin_labels) else f"Bin {i}", "mean_messages": 0, "std_dev_messages": 0, "total_messages_in_bin":0, "percentage_of_total":0, "active_multiplier_period": "Unknown", "active_multiplier_value": 1.0} for i in range(bins_per_24h)]
    seconds_per_day = 24 * 3600
    seconds_per_bin = seconds_per_day // bins_per_24h
    counts_per_day_per_bin = [[0] * bins_per_24h for _ in range(num_days_simulated)]
    for ts in message_timestamps:
        day_index = int(ts // seconds_per_day)
        if day_index >= num_days_simulated: continue
        time_within_day = ts % seconds_per_day
        bin_index = int(time_within_day // seconds_per_bin)
        if 0 <= bin_index < bins_per_24h: counts_per_day_per_bin[day_index][bin_index] += 1
    results = []
    total_messages_all_bins = sum(ts_count for day_counts in counts_per_day_per_bin for ts_count in day_counts)
    for i in range(bins_per_24h):
        messages_in_this_bin_across_days = [counts_per_day_per_bin[day_idx][i] for day_idx in range(num_days_simulated)]
        mean_val = sum(messages_in_this_bin_across_days) / num_days_simulated if num_days_simulated > 0 else 0
        std_dev_val = math.sqrt(sum([(x - mean_val) ** 2 for x in messages_in_this_bin_across_days]) / (num_days_simulated - 1)) if num_days_simulated > 1 else 0
        start_s_total = i * seconds_per_bin; start_h = start_s_total // 3600; start_m = (start_s_total % 3600) // 60
        end_s_total = (i + 1) * seconds_per_bin - 1; end_h = end_s_total // 3600; end_m = (end_s_total % 3600) // 60
        time_bin_label = f"{start_h:02d}:{start_m:02d}-{end_h:02d}:{end_m:02d}"
        total_in_bin = sum(messages_in_this_bin_across_days)
        percentage = (total_in_bin / total_messages_all_bins * 100) if total_messages_all_bins > 0 else 0
        results.append({"time_bin": time_bin_label, "mean_messages": mean_val, "std_dev_messages": std_dev_val, "total_messages_in_bin": total_in_bin, "percentage_of_total": percentage})
    return results

def get_main_simulation_data(user_config_params, num_days_to_simulate=100, bins_per_24h=24):
    config = DEFAULT_CONFIG.copy()
    config["unpromptedTimePeriods_multipliers"] = DEFAULT_CONFIG["unpromptedTimePeriods_multipliers"].copy()
    config["time_period_definitions"] = DEFAULT_CONFIG["time_period_definitions"].copy()
    if "UNPROMPTED_CHANCE_BUILD_AMOUNT" in user_config_params: config["UNPROMPTED_CHANCE_BUILD_AMOUNT"] = user_config_params["UNPROMPTED_CHANCE_BUILD_AMOUNT"]
    if "UNPROMPTED_ROLL_INTERVAL_SECONDS" in user_config_params: config["UNPROMPTED_ROLL_INTERVAL_SECONDS"] = user_config_params["UNPROMPTED_ROLL_INTERVAL_SECONDS"]
    if "UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS" in user_config_params: config["UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS"] = user_config_params["UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS"]
    if "unpromptedTimePeriods_multipliers" in user_config_params:
        for period, value in user_config_params["unpromptedTimePeriods_multipliers"].items():
            if period in config["unpromptedTimePeriods_multipliers"]: config["unpromptedTimePeriods_multipliers"][period] = value
    simulation_total_seconds = num_days_to_simulate * 24 * 3600
    all_message_timestamps = run_simulation_for_duration(config, simulation_total_seconds)
    analyzed_data = analyze_timestamps(all_message_timestamps, simulation_total_seconds, num_days_to_simulate, bins_per_24h)
    if bins_per_24h > 0 and analyzed_data:
        for item in analyzed_data:
            if "time_bin" not in item or not isinstance(item["time_bin"], str) or ":" not in item["time_bin"] or "-" not in item["time_bin"]:
                item["active_multiplier_period"] = "Unknown"; item["active_multiplier_value"] = 1.0; continue
            try:
                bin_start_seconds_in_day = int(item["time_bin"].split(":")[0]) * 3600 + int(item["time_bin"].split(":")[1].split("-")[0]) * 60
                start_hour_of_bin = bin_start_seconds_in_day // 3600
                active_period = get_current_time_period(start_hour_of_bin, config["time_period_definitions"])
                item["active_multiplier_period"] = active_period
                item["active_multiplier_value"] = config["unpromptedTimePeriods_multipliers"].get(active_period, 1.0)
            except ValueError: item["active_multiplier_period"] = "ErrorParsingBin"; item["active_multiplier_value"] = 1.0
    return analyzed_data

def calculate_period_binomial_distributions(user_config_params):
    print(f"[Python Script DBG] calculate_period_binomial_distributions called.", file=sys.stderr)
    config = DEFAULT_CONFIG.copy()
    config["unpromptedTimePeriods_multipliers"] = DEFAULT_CONFIG["unpromptedTimePeriods_multipliers"].copy()
    config["time_period_definitions"] = DEFAULT_CONFIG["time_period_definitions"].copy()
    if "UNPROMPTED_CHANCE_BUILD_AMOUNT" in user_config_params: config["UNPROMPTED_CHANCE_BUILD_AMOUNT"] = user_config_params["UNPROMPTED_CHANCE_BUILD_AMOUNT"]
    if "UNPROMPTED_ROLL_INTERVAL_SECONDS" in user_config_params: config["UNPROMPTED_ROLL_INTERVAL_SECONDS"] = user_config_params["UNPROMPTED_ROLL_INTERVAL_SECONDS"]
    if "unpromptedTimePeriods_multipliers" in user_config_params:
        for period, value in user_config_params["unpromptedTimePeriods_multipliers"].items():
            if period in config["unpromptedTimePeriods_multipliers"]: config["unpromptedTimePeriods_multipliers"][period] = value
    period_distributions_data = {}
    roll_interval_seconds = config["UNPROMPTED_ROLL_INTERVAL_SECONDS"]
    if roll_interval_seconds <= 0: return { "error": "Roll interval must be positive.", "type": "ValueError" }
    for period_name, (start_hour, end_hour) in config["time_period_definitions"].items():
        period_duration_hours = end_hour - start_hour + 1
        period_duration_seconds = period_duration_hours * 3600
        n_trials = math.floor(period_duration_seconds / roll_interval_seconds)
        if n_trials <= 0:
            period_distributions_data[period_name] = {"distribution": [], "expected_messages": 0, "std_dev": 0, "rel_variation": 0, "n_trials": 0, "p_success": 0}; continue
        chance_increment_per_build = config["UNPROMPTED_CHANCE_BUILD_AMOUNT"]
        period_multiplier = config["unpromptedTimePeriods_multipliers"].get(period_name, 1.0)
        effective_chance_percent = chance_increment_per_build * period_multiplier
        p_success = min(effective_chance_percent / 100.0, 1.0); p_success = max(p_success, 0.0)
        print(f"[Python Script DBG] Period: {period_name}, Duration(s): {period_duration_seconds}, Roll Interval(s): {roll_interval_seconds}, n_trials: {n_trials}, p_success: {p_success:.4f}", file=sys.stderr)
        distribution = []
        cumulative_prob = 0.0
        expected_k_binom = n_trials * p_success
        max_k_to_check = math.ceil(expected_k_binom + 5 * math.sqrt(n_trials * p_success * (1 - p_success))) # Check a few SDs out
        max_k_to_check = max(max_k_to_check, 10) # Ensure we check at least a few k values
        max_k_to_check = min(max_k_to_check, n_trials) # Cannot have more successes than trials
        for k in range(n_trials + 1):
            prob_k = binomial_probability(n_trials, k, p_success)
            distribution.append({"messages": k, "probability": prob_k})
            cumulative_prob += prob_k
            if k > max_k_to_check and cumulative_prob > 0.99999: # Stop if tail is negligible and past expected + buffer
                print(f"[Python Script DBG] Stopping early for {period_name} at k={k}, cumulative_prob={cumulative_prob:.5f}", file=sys.stderr); break
        expected_messages = n_trials * p_success
        std_dev = math.sqrt(n_trials * p_success * (1.0 - p_success))
        rel_variation = (std_dev / expected_messages * 100) if expected_messages > 0 else 0
        period_distributions_data[period_name] = {"distribution": distribution, "expected_messages": expected_messages, "std_dev": std_dev, "rel_variation": rel_variation, "n_trials": n_trials, "p_success": p_success}
    print(f"[Python Script DBG] Returning period binomial distributions data: {json.dumps(list(period_distributions_data.keys()))}", file=sys.stderr)
    return period_distributions_data

if __name__ == "__main__":
    input_str = sys.stdin.read()
    print(f"[Python Script DBG] Received stdin: {input_str}", file=sys.stderr)
    try:
        data = json.loads(input_str)
        print(f"[Python Script DBG] Parsed stdin data: {json.dumps(data)}", file=sys.stderr)
        user_config = data.get("user_config")
        calculation_type = data.get("calculation_type", "main_simulation") # Default to main simulation

        if not user_config:
            print(json.dumps({"error": "user_config not provided", "type": "InputError"}))
            sys.exit(1)

        if calculation_type == "main_simulation":
            print("[Python Script DBG] Main sim: Extracted user_config and params", file=sys.stderr)
            num_days = data.get("num_days", 100)
            bins = data.get("bins", 24)
            results = get_main_simulation_data(user_config, num_days, bins)
            print(json.dumps(results))
        elif calculation_type == "period_distribution":
            print("[Python Script DBG] Period dist: Extracted user_config", file=sys.stderr)
            results = calculate_period_binomial_distributions(user_config)
            print(json.dumps(results))
        else:
            print(json.dumps({"error": f"Unknown calculation_type: {calculation_type}", "type": "InputError"}))
            sys.exit(1)

    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSONDecodeError: {str(e)}", "type": "JSONDecodeError"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"An unexpected error occurred in Python: {str(e)}", "type": type(e).__name__}))
        sys.exit(1)

