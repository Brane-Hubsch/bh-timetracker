<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Absence (vacation, care of sick child, sick leave, ...) per member, and the length of a full
 * working day per organization, which a full day of absence counts as.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->unsignedInteger('workday_seconds')->default(28800);
        });

        Schema::create('absences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->date('starts_on');
            $table->date('ends_on');
            // Null: full working days.
            $table->unsignedInteger('seconds_per_day')->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'user_id', 'starts_on']);
            $table->index(['organization_id', 'starts_on', 'ends_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('absences');

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('workday_seconds');
        });
    }
};
