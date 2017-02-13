import Promise = require("bluebird");

import {KidaptiveErrorCode, KidaptiveError} from "./kidaptive_error";
import {User, LearnerApi, Learner} from "../../../swagger-client/api";
import {KidaptiveConstants} from "./kidaptive_constants";
import SwaggerClient = require("swagger-client");

/**
 * Created by solomonliu on 7/11/16.
 */

interface LearnerManagerDelegate {
    getCurrentUser: () => User;
    getAppApiKey: () => string;
    getSwaggerClient: () => SwaggerClient;
}

class LearnerManager {
    private learnerMap: {[key: number]: Learner} = {};

    constructor(private delegate: LearnerManagerDelegate){
        if (!delegate) {
            throw new KidaptiveError(KidaptiveErrorCode.MISSING_DELEGATE, "LearnerManagerDelegate not found");
        }
    }

    createLearner(name:string, birthday?: Date, gender?:Learner.GenderEnum): Promise<Learner> {
        if (!name) {
            throw new KidaptiveError(KidaptiveErrorCode.INVALID_PARAMETER, "name is required");
        }

        if (!gender) {
            gender = Learner.GenderEnum.Decline;
        }

        let birthdayNumber:number = null;
        if (birthday) {
            birthdayNumber = birthday.getTime();
        }

        let currentUser = this.delegate.getCurrentUser();
        if (!currentUser) {
            throw new KidaptiveError(KidaptiveErrorCode.NOT_LOGGED_IN, "not logged in");
        }

        let learner: Learner = new Learner();
        learner.name = name;
        learner.gender = gender;
        learner.birthday = birthdayNumber;

        return this.delegate.getSwaggerClient().then(function(swagger) {
            return swagger.learner.post_learner({"Api-Key": this.delegate.getAppApiKey(), Learner: learner})
        }.bind(this)).then(function(success:any) {
            return {body: success.obj};
        }, function(error) {
            return Promise.reject(error.errorObj);
        }).then(function(data) {
            this.learnerMap[data.body.id] = data.body;
            this.storeLearners();
            return data.body;
        }.bind(this)).catch(function(error) {
            if (error.response) {
                if (error.response.statusCode == 400) {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.INVALID_PARAMETER, error.response.statusMessage));
                } else if (error.response.statusCode == 401) {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.API_KEY_ERROR, error.response.statusMessage));
                } else {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.WEB_API_ERROR, error.response.statusMessage));
                }
            } else {
                return Promise.reject(new KidaptiveError(KidaptiveErrorCode.GENERIC_ERROR, error));
            }
        }) as Promise<Learner>
    }

    syncLearnerList(): Promise<Learner[]> {
        let currentUser = this.delegate.getCurrentUser();
        if (!currentUser) {
            throw new KidaptiveError(KidaptiveErrorCode.NOT_LOGGED_IN, "not logged in");
        }

        return this.delegate.getSwaggerClient().then(function(swagger){
            return swagger.learner.get_learner({"Api-Key": this.delegate.getAppApiKey()});
        }.bind(this)).then(function(success:any) {
            return {body: success.obj};
        }, function(fail) {
            return Promise.reject(fail.errorObj);
        }).then(function(data) {
            let learners: {[key: number]: Learner} = {};
            for (let l of data.body) {
                learners[l.id] = l;
                this.learnerMap = learners;
            }
            this.storeLearners();
            return data.body;
        }.bind(this)).catch(function(error) {
            if (error.response) {
                if (error.response.statusCode == 401) {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.API_KEY_ERROR, error.response.statusMessage));
                } else {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.WEB_API_ERROR, error.response.statusMessage));
                }
            } else {
                return Promise.reject(new KidaptiveError(KidaptiveErrorCode.GENERIC_ERROR, error));
            }
        }) as Promise<Learner[]>;
    }

    listLearners(): Learner[] {
        let learnerList:Learner[] = [];
        for (let i in this.learnerMap) {
            learnerList.push(this.learnerMap[i]);
        }

        return learnerList;
    }

    getLearner(learnerId:number): Learner {
        return this.learnerMap[learnerId];
    }

    //clears local copy of learner info; used when logging out
    clearLearnerList() {
        this.learnerMap = {};
        LearnerManager.deleteStoredLearners();
    }

    updateLearner(learnerId:number, data?:{name?:string, birthday?:Date, gender?:Learner.GenderEnum}): Promise<Learner> {
        if (!learnerId) {
            throw new KidaptiveError(KidaptiveErrorCode.INVALID_PARAMETER, "learnerId is required");
        }

        let currentUser = this.delegate.getCurrentUser();
        if (!currentUser) {
            throw new KidaptiveError(KidaptiveErrorCode.NOT_LOGGED_IN, "not logged in");
        }

        let learner:Learner = this.getLearner(learnerId);
        if (!learner) {
            throw new KidaptiveError(KidaptiveErrorCode.LEARNER_NOT_FOUND, "Learner " + learnerId + " not found");
        }

        //nothing to be done
        if (!data || (!data.name && !data.birthday && !data.gender)) {
            return Promise.resolve(this.learnerMap[learnerId]);
        }

        //current values as defaults
        let updateData: Learner = new Learner();
        updateData.name = learner.name;
        updateData.gender = learner.gender;
        updateData.birthday = learner.birthday;
        updateData.icon = learner.icon;

        if (data.name) {
            updateData.name = data.name;
        }
        if (data.birthday) {
            updateData.birthday = data.birthday.getTime();
        }
        if (data.gender) {
            updateData.gender = data.gender;
        }

        return this.delegate.getSwaggerClient().then(function(swagger){
            return swagger.learner.post_learner_learnerId({"Api-Key": this.delegate.getAppApiKey(), learnerId: learnerId, Learner:updateData});
        }.bind(this)).then(function(success:any) {
            return {body: success.obj};
        }, function(fail) {
            return Promise.reject(fail.errorObj);
        }).then(function(data) {
            this.learnerMap[data.body.id] = data.body;
            this.storeLearners();
            return data.body;
        }.bind(this)).catch(function(error) {
            if (error.response) {
                if (error.response.statusCode == 400) {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.INVALID_PARAMETER, error.response.statusMessage));
                } else if (error.response.statusCode == 401) {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.API_KEY_ERROR, error.response.statusMessage));
                } else {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.WEB_API_ERROR, error.response.statusMessage));
                }
            } else {
                return Promise.reject(new KidaptiveError(KidaptiveErrorCode.GENERIC_ERROR, error));
            }
        }) as Promise<Learner>;
    }

    deleteLearner(learnerId:number): Promise<Learner> {
        if (!learnerId) {
            throw new KidaptiveError(KidaptiveErrorCode.INVALID_PARAMETER, "learnerId is required");
        }

        let currentUser = this.delegate.getCurrentUser();
        if (!currentUser) {
            throw new KidaptiveError(KidaptiveErrorCode.NOT_LOGGED_IN, "not logged in");
        }

        let learner:Learner = this.getLearner(learnerId);
        if (!learner) {
            throw new KidaptiveError(KidaptiveErrorCode.LEARNER_NOT_FOUND, "Learner " + learnerId + " not found");
        }

        return this.delegate.getSwaggerClient().then(function(swagger){
            return swagger.learner.delete_learner_learnerId({"Api-Key": this.delegate.getAppApiKey(), learnerId: learnerId});
        }.bind(this)).then(function(success:any) {
            return {body: success.obj};
        }, function(fail) {
            return Promise.reject(fail.errorObj);
        }).then(function() {
            learner = this.learnerMap[learnerId];
            delete this.learnerMap[learnerId];
            this.storeLearners();
            return learner;
        }.bind(this)).catch(function(error) {
            if (error.response) {
                if (error.response.statusCode == 401) {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.API_KEY_ERROR, error.response.statusMessage));
                } else if (error.response.statusCode == 404) {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.LEARNER_NOT_FOUND, error.response.statusMessage));
                } else {
                    return Promise.reject(new KidaptiveError(KidaptiveErrorCode.WEB_API_ERROR, error.response.statusMessage));
                }
            } else {
                return Promise.reject(new KidaptiveError(KidaptiveErrorCode.GENERIC_ERROR, error));
            }
        }.bind(this)) as Promise<Learner>;
    }

    private storeLearners() {
        localStorage.setItem('kidaptive.alp.learners', JSON.stringify(this.learnerMap))
    }

    loadStoredLearners() {
        this.learnerMap = JSON.parse(localStorage.getItem('kidaptive.alp.learners'));
    }

    private static deleteStoredLearners() {
        localStorage.removeItem('kidaptive.alp.learners');
    }
}

export {LearnerManagerDelegate, LearnerManager}