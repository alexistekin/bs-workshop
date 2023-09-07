import { Button, CardContent,  Grid, LinearProgress } from "@material-ui/core";
import { useAsyncAwsApp } from "../../hooks/useAwsApp";
import { AWSComponent, GenericAWSEnvironment } from "@aws/plugin-aws-apps-common-for-backstage";
import { EmptyState, InfoCard } from "@backstage/core-components";
import React, { useState } from "react";
import { useApi } from "@backstage/core-plugin-api";
import { AADApi, bawsApiRef } from '../../api';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertTitle, Typography } from "@mui/material";
import { Entity } from "@backstage/catalog-model";
import { CatalogApi, useEntity } from "@backstage/plugin-catalog-react";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { sleep } from "../../helpers/util";

const DeleteAppPanel = ({
    input: { awsComponent, entity, catalogApi, api }
  }: { input: { awsComponent:AWSComponent; entity:Entity; catalogApi:CatalogApi; api:AADApi} }) => {

    const [disabled, setDisabled] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const [isDeleteSuccessful, setIsDeleteSuccessful] = useState(false);
    const [deleteResultMessage, setDeleteResultMessage] = useState("");
    const navigate = useNavigate();

    const handleCloseAlert = () => {
      setDeleteResultMessage("");
    };

    const deleteRepo= (gitHost:string, gitRepo:string)=> {
      api.deleteRepository({
        gitHost, 
        gitProject:gitRepo.split('/')[0],
        gitRepoName: gitRepo.split('/')[1],
        gitAdminSecret:'aad-admin-gitlab-secrets'
      }).then(results=> {
        console.log(results);
        setDeleteResultMessage("Gitlab Repository deleted.")
        setIsDeleteSuccessful(true)
      }).catch(error=>{
        console.log(error)
        setDeleteResultMessage(`Error deleting Repository ${error}.`)
        setSpinning(false);
        setIsDeleteSuccessful(false)
      })
    }

    const deleteFromCatalog = () => {
      console.log("Deleting entity from backstage catalog")
      setDeleteResultMessage("Deleting entity from backstage catalog")
      const uid = entity.metadata["uid"]?.toString() || "";
      catalogApi.removeEntityByUid(uid)
    }
    
    const deleteAppFromSingleProvider = async (appName:string, env:GenericAWSEnvironment) =>
    {
      api.setBackendParams({
        appName:appName,
        awsAccount:env.providerData.accountNumber,
        awsRegion:env.providerData.region,
        prefix: env.providerData.prefix,
        providerName: env.providerData.name
      });
      const stackName = env.app.cloudFormationStackName;
      const accessRole = `arn:aws:iam::${env.providerData.accountNumber}:role/${env.providerData.prefix}-${env.providerData.name}-operations-role`
      const results = api.deleteProvider({stackName, accessRole});
      return results
    }
    const deleteSecret = (secretName:string) => {
      console.log(secretName);
      api.setBackendParams({
        appName:entity.metadata.name,
        awsAccount:'',
        awsRegion:awsComponent.platformRegion,
        prefix: '',
        providerName: ''
      });

      api.deletePlatformSecret({secretName}).then(result=> {
        console.log(result)
        setDeleteResultMessage("Secret Deleted.")
      }).catch(error=> {
        setSpinning(false)
        setIsDeleteSuccessful(false)
        setDeleteResultMessage(error.toString())
      })

    }
    const handleClickDelete = async () => {
      const deployedEnvironments = Object.keys(awsComponent.environments).length;
      if (deployedEnvironments===1)
      {
        handleClickDeleteAll();
      }
      else
      {
        if (confirm('Are you sure you want to delete this app?')) {
          setSpinning(true);
          deleteAppFromSingleProvider(awsComponent.componentName, awsComponent.currentEnvironment).then(async results => {
            console.log(results)
            setIsDeleteSuccessful(true);
            setDeleteResultMessage("Cloud Formation stack delete initiated.")
            //now update repo to remove environment
            // api.InitiateGitDelete
            await sleep(2000);
            // awsComponent.currentEnvironment.providerData.name
            
          }).catch(error=> {
            console.log(error)
            setSpinning(false)
            setIsDeleteSuccessful(false)
            setDeleteResultMessage(error.toString())
            return;
          })

         
          
        } else {
          // Do nothing!
        }          
      }
    };

    const handleClickDeleteAll = async () => {
      if (confirm('Are you sure you want to delete this app?')) {
        const deployedEnvironments = Object.keys(awsComponent.environments);
        deployedEnvironments.forEach(env=> {
          const environmentToRemove:GenericAWSEnvironment = awsComponent.environments[env];
          // remove environment x 
          deleteAppFromSingleProvider(awsComponent.componentName, environmentToRemove).then(async results => {
            console.log(results)
            setIsDeleteSuccessful(true);
            setDeleteResultMessage(`Cloud Formation delete stack on provider ${env} initiated.`)
            await sleep(2000);
            
          }).catch(error=> {
            console.log(error)
            setSpinning(false)
            setIsDeleteSuccessful(false)
            setDeleteResultMessage(error.toString())
            return;
          })
        })
        // Delete the repo now.
        const gitHost = entity.metadata.annotations ? entity.metadata.annotations['gitlab.com/instance']?.toString() : "";
        const gitRepo = entity.metadata.annotations ? entity.metadata.annotations['gitlab.com/project-slug']?.toString() : "";
        deleteRepo(gitHost, gitRepo)
        await sleep(2000);
        deleteSecret(entity.metadata['repo-secret-arn']?.toString() || "")
        deleteFromCatalog()
        setSpinning(false);
        await sleep(2000);
        setDeleteResultMessage("Redirect to home ....")
        navigate('/')       
        setDisabled(false)
      } else {
        // Do nothing!
      }
    };

    return (
        <InfoCard title="Delete Component">
          <CardContent>
            <Grid>
              <Grid container spacing={2}>
                <Grid item zeroMinWidth xs={8}>
                  <Typography sx={{ fontWeight: 'bold' }}>Delete this component from current environment</Typography>
                </Grid>
                <Grid item zeroMinWidth xs={12}>
                  <Typography noWrap>
                        {/* <DeleteIcon fontSize="large" /> */}
                        <Button variant="contained" style={{backgroundColor:'red'}} onClick={handleClickDelete} disabled={disabled}>Delete</Button>
                  </Typography>
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid item zeroMinWidth xs={8}>
                  <Typography sx={{ fontWeight: 'bold' }}>Delete this component and all of its resources</Typography>
                </Grid>
                <Grid item zeroMinWidth xs={12}>
                  <Typography noWrap>
                        {/* <DeleteIcon fontSize="large" /> */}
                        <Button variant="contained" style={{backgroundColor:'red'}} onClick={handleClickDeleteAll} disabled={disabled}>Delete from all environments</Button>
                  </Typography>
                </Grid>
              </Grid>
              <Grid item zeroMinWidth xs={12}>
                {isDeleteSuccessful  && deleteResultMessage && (
                  <Alert id="alertGood" sx={{ mb: 2 }} severity="success" onClose={handleCloseAlert}>
                    <AlertTitle>Success</AlertTitle>
                    <strong>{entity.metadata.name}</strong> was successfully deleted!
                    {!!deleteResultMessage && (<><br /><br />{deleteResultMessage}</>)}
                  </Alert>
                  )}
                  {!isDeleteSuccessful && deleteResultMessage && (
                    <Alert  id="alertBad" sx={{ mb: 2 }} severity="error" onClose={handleCloseAlert}>
                      <AlertTitle>Error</AlertTitle>
                      Failed to delete <strong>{entity.metadata.name}</strong> promotion.
                      {!!deleteResultMessage && (<><br /><br />{deleteResultMessage}</>)}
                    </Alert>
                  )}
              </Grid>
            </Grid>
            <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={spinning}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
          </CardContent>
        </InfoCard>
      );
}



export const DeleteComponentCard = () => {
    const awsAppLoadingStatus = useAsyncAwsApp();
    const { entity } = useEntity();
    const catalogApi = useApi(catalogApiRef);
    const api = useApi(bawsApiRef);

    if (awsAppLoadingStatus.loading) {
      return <LinearProgress />
    } else if (awsAppLoadingStatus.component) {
      console.log(awsAppLoadingStatus.component)
      const input = {
        awsComponent: awsAppLoadingStatus.component,
        entity,
        catalogApi,
        api
      };
      return <DeleteAppPanel input={input} />
    } else {
      return <EmptyState missing="data" title="No state data to show" description="State data would show here" />
    }
  };
  