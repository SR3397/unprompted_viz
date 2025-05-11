import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

interface UserConfig { UNPROMPTED_CHANCE_BUILD_AMOUNT: number; UNPROMPTED_ROLL_INTERVAL_SECONDS: number; UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS: number; unpromptedTimePeriods_multipliers: { Night: number; Morning: number; Afternoon: number; Evening: number; }; }
interface MainSimulationRequestBody { config: UserConfig; num_days_to_simulate: number; bins_per_24h: number; calculation_type?: "main_simulation"; }
interface PeriodDistributionRequestBody { config: UserConfig; calculation_type: "period_distribution"; }
type SimulationRequestBody = MainSimulationRequestBody | PeriodDistributionRequestBody;

function isValidUserConfig(config: any): config is UserConfig { return ( typeof config === "object" && config !== null && typeof config.UNPROMPTED_CHANCE_BUILD_AMOUNT === "number" && typeof config.UNPROMPTED_ROLL_INTERVAL_SECONDS === "number" && typeof config.UNPROMPTED_CHANCE_BUILD_INTERVAL_SECONDS === "number" && typeof config.unpromptedTimePeriods_multipliers === "object" && config.unpromptedTimePeriods_multipliers !== null && typeof config.unpromptedTimePeriods_multipliers.Night === "number" && typeof config.unpromptedTimePeriods_multipliers.Morning === "number" && typeof config.unpromptedTimePeriods_multipliers.Afternoon === "number" && typeof config.unpromptedTimePeriods_multipliers.Evening === "number" ); }
function isValidMainSimulationBody(body: any): body is MainSimulationRequestBody { return ( isValidUserConfig(body.config) && typeof body.num_days_to_simulate === "number" && body.num_days_to_simulate > 0 && typeof body.bins_per_24h === "number" && body.bins_per_24h > 0 ); }
function isValidPeriodDistributionBody(body: any): body is PeriodDistributionRequestBody { return ( isValidUserConfig(body.config) && body.calculation_type === "period_distribution" ); }

export async function POST(req: NextRequest) {
  console.log("[API Route DBG] Received POST request to /api/simulate");
  try {
    const body: SimulationRequestBody = await req.json();
    console.log("[API Route DBG] Request body:", JSON.stringify(body, null, 2));

    const calculationType = body.calculation_type || "main_simulation";
    let pythonPayload;

    if (calculationType === "main_simulation") {
      if (!isValidMainSimulationBody(body)) { console.error("[API Route DBG] Invalid input for main_simulation:", body); return NextResponse.json({ error: "Invalid input for main simulation." }, { status: 400 }); }
      pythonPayload = { user_config: body.config, num_days: body.num_days_to_simulate, bins: body.bins_per_24h, calculation_type: "main_simulation" };
      console.log("[API Route DBG] Main_simulation payload for Python:", JSON.stringify(pythonPayload, null, 2));
    } else if (calculationType === "period_distribution") {
      if (!isValidPeriodDistributionBody(body)) { console.error("[API Route DBG] Invalid input for period_distribution:", body); return NextResponse.json({ error: "Invalid input for period distribution." }, { status: 400 }); }
      pythonPayload = { user_config: body.config, calculation_type: "period_distribution" };
      console.log("[API Route DBG] Period_distribution payload for Python:", JSON.stringify(pythonPayload, null, 2));
    } else { console.error("[API Route DBG] Unknown calculation_type:", calculationType); return NextResponse.json({ error: `Unknown calculation_type: ${calculationType}` }, { status: 400 }); }

    const scriptPath = path.resolve(process.cwd(), "src", "lib", "simulation.py");
    console.log(`[API Route DBG] Attempting to execute Python script at: ${scriptPath}`);

    const pythonProcess = spawn("python3", [scriptPath]);
    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdin.write(JSON.stringify(pythonPayload));
    pythonProcess.stdin.end();
    pythonProcess.stdout.on("data", (data) => { stdoutData += data.toString(); });
    pythonProcess.stderr.on("data", (data) => { stderrData += data.toString(); console.error(`[API Route DBG] Python script stderr chunk: ${data}`); });

    return new Promise((resolve) => {
      pythonProcess.on("close", (code) => {
        console.log(`[API Route DBG] Python script finished with code ${code}`);
        if (stderrData) { console.error(`[API Route DBG] Full Python stderr: ${stderrData}`); }
        if (code === 0) {
          try {
            const result = JSON.parse(stdoutData);
            // CRITICAL LOGGING HERE:
            console.log("[API Route DBG] PRE-RESPONSE: Parsed Python stdout (type:", typeof result, "):", JSON.stringify(result, null, 2));
            if (calculationType === "period_distribution") {
                console.log("[API Route DBG] PRE-RESPONSE (PeriodDist): Night data exists?", !!result.Night);
                console.log("[API Route DBG] PRE-RESPONSE (PeriodDist): Morning data exists?", !!result.Morning);
            }
            resolve(NextResponse.json(result));
          } catch (e) {
            console.error("[API Route DBG] Failed to parse Python script output:", e);
            console.error("[API Route DBG] Raw stdout from Python:", stdoutData);
            resolve(NextResponse.json({ error: "Failed to parse simulation output.", details: stdoutData }, { status: 500 }));
          }
        } else {
          console.error("[API Route DBG] Python script execution failed.");
          resolve(NextResponse.json({ error: "Simulation script failed to execute.", details: stderrData }, { status: 500 }));
        }
      });
      pythonProcess.on("error", (err) => { console.error("[API Route DBG] Failed to start Python script:", err); resolve(NextResponse.json({ error: "Failed to start simulation script.", details: err.message }, { status: 500 })); });
    });
  } catch (error: any) { console.error("[API Route DBG] Error in POST handler:", error); return NextResponse.json({ error: "An unexpected error occurred on the server.", details: error.message }, { status: 500 }); }
}

