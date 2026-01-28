<?php

namespace Tests\Unit\Jobs;

use Tests\TestCase;
use App\Jobs\ProcessRenderJob;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

class ProcessRenderJobTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The job should be dispatchable onto the queue with the given ID.
     */
    public function test_job_can_be_dispatched(): void
    {
        Queue::fake();

        $jobId = 'test-job-id-123';

        ProcessRenderJob::dispatch($jobId);

        Queue::assertPushed(ProcessRenderJob::class, function ($job) use ($jobId) {
            return $job->jobId === $jobId;
        });
    }

    /**
     * The job should expose basic configuration such as tries and timeout.
     */
    public function test_job_has_expected_defaults(): void
    {
        $jobId = 'another-job-id';

        $job = new ProcessRenderJob($jobId);

        $this->assertSame($jobId, $job->jobId);
        $this->assertSame(3, $job->tries);
        $this->assertSame(600, $job->timeout);
    }

    /**
     * When a render job cannot be found, handle() should bubble up
     * the ModelNotFoundException from RenderJob::findOrFail().
     *
     * This uses the real database schema but does not insert any rows,
     * so no foreign keys are touched.
     */
    public function test_job_handles_missing_render_job_gracefully(): void
    {
        $this->expectException(ModelNotFoundException::class);

        $job = new ProcessRenderJob('non-existent-id');
        $job->handle();
    }
}





