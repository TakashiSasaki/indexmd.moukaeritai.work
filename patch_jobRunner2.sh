#!/bin/bash
sed -i '/const quotaInterruption = classifyJobQuotaInterruption(finalData, res?.status);/i \
      const isConfigurationFailure = finalData?.failureKind === "providerInvalidArgument" || res?.status === 400 || finalData?.error?.includes("schema");\
      if (isConfigurationFailure) {\
        item.status = "failed";\
        item.error = finalData?.error || "Configuration Error";\
        item.failureKind = "providerInvalidArgument";\
        jobStore.appendItem(jobId, item);\
        jobStore.updateJob(jobId, {\
          status: "failed",\
          lastError: item.error,\
          lastFailureKind: item.failureKind,\
          lastEvent: {\
            type: "jobFailed",\
            timestamp: new Date().toISOString(),\
            message: `Job failed due to deterministic configuration error on ${sampleTitle}`\
          }\
        });\
        break;\
      }\
' src/lib/visualAnalysis/serverJobs/jobRunner.ts
