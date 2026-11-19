<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Uploaded images: the directory of the stored sizes (see App\Services\Images\ImageStorage).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('avatar_url');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->string('logo_path')->nullable();
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->string('logo_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('avatar_path'));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('logo_path'));
        Schema::table('clients', fn (Blueprint $table) => $table->dropColumn('logo_path'));
    }
};
