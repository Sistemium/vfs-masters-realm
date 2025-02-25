exports = function(changeEvent) {
  console.log("Function started. Change event received:", JSON.stringify(changeEvent));

  const collectionServiceTask = context.services.get("mongodb-atlas").db("Masters").collection("ServiceTask");
  const collectionServicePoint = context.services.get("mongodb-atlas").db("Masters").collection("ServicePoint");
  const collectionCustomer = context.services.get("mongodb-atlas").db("Masters").collection("Customer");

  let servicePointId;

  console.log("Analyzing changeEvent for operationType...");

  if (changeEvent.operationType === "update") {
    const updatedFields = changeEvent.updateDescription.updatedFields;
    if ("assigneeIds" in updatedFields && Object.keys(updatedFields).length === 1) {
      console.log("Update only modified 'assigneeIds'. Exiting to prevent recursion.");
      return;
    }
  }

  if (changeEvent.operationType === "delete") {
    console.log("Detected delete operation on ServiceTask.");
    servicePointId = changeEvent.fullDocumentBeforeChange.servicePoint;
    console.log(`ServiceTask delete detected. Extracted servicePointId: ${servicePointId}`);
  } else {
    servicePointId = changeEvent.fullDocument.servicePoint;
    console.log(`ServiceTask insert/update detected. Extracted servicePointId: ${servicePointId}`);
  }

  if (!servicePointId) {
    console.log("No servicePointId identified. Exiting function.");
    return;
  }

  console.log("Proceeding with servicePointId:", servicePointId);

  return collectionServiceTask.find({ servicePoint: servicePointId }).toArray()
    .then(serviceTasks => {
      console.log(`Fetched service tasks for servicePointId ${servicePointId}:`, JSON.stringify(serviceTasks));

      const new_assigneeIds = serviceTasks
        .map(task => task.assignee)
        .filter(id => id != null && id != undefined);

      console.log(`Mapped assigneeIds for update:`, JSON.stringify(new_assigneeIds));

      console.log(`Updating ServicePoint collection for servicePointId ${servicePointId} with assigneeIds.`);

      return collectionServicePoint.updateOne(
        { _id: servicePointId },
        { $set: { assigneeIds: new_assigneeIds } }
      )
      .then(updateResult => {
        console.log("Update result for ServicePoint:", JSON.stringify(updateResult));

        return collectionServicePoint.findOne({ _id: servicePointId })
          .then(servicePoint => {
            const customerId = servicePoint ? servicePoint.customer : null;
            console.log(`Found ServicePoint. CustomerId: ${customerId}`);

            if (customerId) {
              console.log(`Fetching ServicePoints for customerId: ${customerId}`);

              return collectionServicePoint.find({ customer: customerId }).toArray()
                .then(servicePoints => {
                  console.log(`ServicePoints fetched for customerId ${customerId}:`, JSON.stringify(servicePoints));

                  let allAssigneeIds = servicePoints.reduce((acc, sp) => {
                    if (sp.assigneeIds) {
                      acc = acc.concat(sp.assigneeIds);
                    }
                    return acc;
                  }, []);

                  allAssigneeIds = [...new Set(allAssigneeIds)].filter(id => id != null && id != undefined);

                  console.log(`Consolidated assigneeIds for Customer update:`, JSON.stringify(allAssigneeIds));

                  return collectionCustomer.updateOne(
                    { _id: customerId },
                    { $set: { assigneeIds: allAssigneeIds } }
                  )
                  .then(customerUpdateResult => {
                    console.log("Update result for Customer:", JSON.stringify(customerUpdateResult));
                  });
                });
            }
          });
      })
      .catch(updateError => {
        console.error("Error during update operation:", updateError);
      });
    })
    .catch(fetchError => {
      console.error("Error during fetch operation:", fetchError);
    });
};