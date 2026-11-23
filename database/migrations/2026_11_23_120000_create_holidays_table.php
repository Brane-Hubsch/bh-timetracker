<?php

use App\Support\SwedishHolidays;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Holidays per organization (days that aren't working days). Existing organizations get the Swedish
 * holidays of 2026 and 2027, which the app used to assume.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('holidays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('name', 100);
            $table->timestamps();

            $table->unique(['organization_id', 'date']);
        });

        $now = now();

        foreach (DB::table('organizations')->pluck('id') as $organizationId) {
            foreach ([2026, 2027] as $year) {
                DB::table('holidays')->insert(array_map(fn (string $date, string $name) => [
                    'organization_id' => $organizationId,
                    // The format Eloquent's date cast stores.
                    'date' => "{$date} 00:00:00",
                    'name' => $name,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], array_keys(SwedishHolidays::for($year)), SwedishHolidays::for($year)));
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('holidays');
    }
};
